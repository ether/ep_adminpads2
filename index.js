const $ = require('cheerio');
const eejs = require('ep_etherpad-lite/node/eejs');
const padManager = require('ep_etherpad-lite/node/db/PadManager');
const api = require('ep_etherpad-lite/node/db/API');
const queryLimit = 12;

const isNumeric = (arg) => typeof arg == 'number' || (typeof arg == 'string' && parseInt(arg));

const search = async (query) => {
  const {padIDs} = await padManager.listAllPads();
  const data = {
    progress: 1,
    messageId: 'ep_adminpads2_search-done',
    query: query,
    total: padIDs.length,
  };
  let maxResult = 0;
  let result = padIDs;
  if (query.pattern != null && query.pattern !== '') {
    let pattern = '*' + query.pattern + '*';
    pattern = regExpQuote(pattern);
    pattern = pattern.replace(/(\\\*)+/g, '.*');
    pattern = '^' + pattern + '$';
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

  let rs = result.slice(query.offset, query.offset + query.limit);

  data.results = rs.map((padName) => ({padName, lastEdited: '', userCount: 0}));
  if (!data.results.length) data.messageId = 'ep_adminpads2_no-results';
  await Promise.all(data.results.map(async (entry) => {
    const pad = await padManager.getPad(entry.padName);
    entry.userCount = api.padUsersCount(entry.padName).padUsersCount;
    try {
      entry.lastEdited = await pad.getLastEdit();
    } catch (e) {
      console.error(`Error retrieving last edited value for pad ${entry.padName}:`, e);
    }
  }));
  return data;
};

exports.expressCreateServer = (hook_name, args, cb) => {
  args.app.get('/admin/pads', (req, res) => {
    let render_args = {
      errors: [],
    };
    res.send(eejs.require('ep_adminpads2/templates/admin/pads.html', render_args));
  });
  return cb();
};

let io = null;

exports.socketio = (hook_name, args) => {
  io = args.io.of('/pluginfw/admin/pads');
  io.on('connection', (socket) => {
    socket.on('load', async (query) => {
      let result = await search({pattern: '', offset: 0, limit: queryLimit});
      socket.emit('search-result', result);
    });

    socket.on('search', async (query) => {
      let result = await search(query);
      socket.emit('search-result', result);
    });

    socket.on('delete', async (padId) => {
      let padExists = await padManager.doesPadExists(padId);
      if (padExists) {
        //pad exists, remove
        let pad = await padManager.getPad(padId);
        await pad.remove();
        socket.emit('progress', {progress: 1});
      }
    });
  });
};

const updatePads = (hookName, args, cb) => {
  io.emit('progress', {progress: 1});
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
