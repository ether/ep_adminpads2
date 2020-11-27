/* global exports, require */

const $ = require('cheerio');
const eejs = require('ep_etherpad-lite/node/eejs');
const padManager = require('ep_etherpad-lite/node/db/PadManager');
const api = require('ep_etherpad-lite/node/db/API');

let ioNs = null;
const queryLimit = 12;

const isNumeric = (arg) => typeof arg === 'number' || (typeof arg === 'string' && parseInt(arg));

const search = async (query) => {
  const {padIDs} = await padManager.listAllPads();
  const data = {
    progress: 1,
    messageId: 'ep_adminpads2_search-done',
    query,
    total: padIDs.length,
  };
  let maxResult = 0;
  let result = padIDs;
  if (query.pattern != null && query.pattern !== '') {
    let pattern = `*${query.pattern}*`;
    pattern = regExpQuote(pattern);
    pattern = pattern.replace(/(\\\*)+/g, '.*');
    pattern = `^${pattern}$`;
    const regex = new RegExp(pattern, 'i');
    result = result.filter(regex.test.bind(regex));
  }

  data.total = result.length;

  maxResult = result.length - 1;
  if (maxResult < 0) {
    maxResult = 0;
  }

  if (!isNumeric(query.offset) || query.offset < 0) {
    query.offset = 0;
  } else if (query.offset > maxResult) {
    query.offset = maxResult;
  }

  if (!isNumeric(query.limit) || query.limit < 0) {
    query.limit = queryLimit;
  }

  const rs = result.slice(query.offset, query.offset + query.limit);

  data.results = rs.map((padName) => ({padName, lastEdited: '', userCount: 0}));
  if (!data.results.length) data.messageId = 'ep_adminpads2_no-results';
  await Promise.all(data.results.map(async (entry) => {
    const pad = await padManager.getPad(entry.padName);
    entry.userCount = api.padUsersCount(entry.padName).padUsersCount;
    entry.lastEdited = await pad.getLastEdit();
  }));
  return data;
};

exports.expressCreateServer = (hookName, {app}, cb) => {
  app.get('/admin/pads', (req, res) => {
    const render_args = {
      errors: [],
    };
    res.send(eejs.require('ep_adminpads2/templates/admin/pads.html', render_args));
  });
  return cb();
};

exports.socketio = (hookName, {io}, cb) => {
  ioNs = io.of('/pluginfw/admin/pads');
  ioNs.on('connection', (socket) => {
    const _search = async (query) => {
      try {
        const result = await search(query);
        socket.emit('search-result', result);
      } catch (err) {
        socket.emit('search-error', err.stack ? err.stack : err.toString());
      }
    };
    socket.on('load', () => _search({pattern: '', offset: 0, limit: queryLimit}));
    socket.on('search', _search);

    socket.on('delete', async (padId) => {
      const padExists = await padManager.doesPadExists(padId);
      if (padExists) {
        // pad exists, remove
        const pad = await padManager.getPad(padId);
        await pad.remove();
        socket.emit('progress', {progress: 1});
      }
    });
  });
  return cb();
};

const updatePads = (hookName, context, cb) => {
  ioNs.emit('progress', {progress: 1});
  return cb();
};

exports.padRemove = updatePads;
exports.padCreate = updatePads;

exports.eejsBlock_adminMenu = (hookName, context, cb) => {
  const ul = $('<ul>').html(context.content);
  const pfx = ul.find('li a').attr('href').match(/^((?:\.\.\/)*)/)[1];
  ul.append(
      $('<li>').append(
          $('<a>')
              .attr('href', `${pfx}pads`)
              .attr('data-l10n-id', 'ep_adminpads2_manage-pads')
              .text('Manage pads')));
  context.content = ul.html();
  return cb();
};

const regExpQuote = (x) => x.toString().replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');
