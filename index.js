const eejs = require('ep_etherpad-lite/node/eejs');
const padManager = require('ep_etherpad-lite/node/db/PadManager');
const api = require('ep_etherpad-lite/node/db/API');
const queryLimit = 12;

RegExp.quote = function (x) {
  return x.toString().replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');
};
const isNumeric = function (arg) {
  return typeof arg == 'number' || (typeof arg == 'string' && parseInt(arg));
};

let pads = {
  pads: [],
  search: async function (query) {
    let the_pads = await padManager.listAllPads();
    return await pads._do_search(the_pads.padIDs, query);
  },
  _do_search: async function (pads, query) {
    let data = {
      progress: 1,
      message: 'Search done.',
      query: query,
      total: pads.length,
    },
        maxResult = 0,
        result = [];
    if (query['pattern'] != null && query['pattern'] !== '') {
      let pattern = '*' + query.pattern + '*';
      pattern = RegExp.quote(pattern);
      pattern = pattern.replace(/(\\\*)+/g, '.*');
      pattern = '^' + pattern + '$';
      let regex = new RegExp(pattern, 'i');
      pads.forEach(function (padID) {
        if (regex.test(padID)) {
          result.push(padID);
        }
      });
    } else {
      result = pads;
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

    pads.pads = rs;

    let entrySet;
    data.results = [];

    rs.forEach(function (value) {
      entrySet = {padName: value, lastEdited: '', userCount: 0};
      data.results.push(entrySet);
    });

    let getEdited = [];
    if (data.results.length > 0) {
      data.results.forEach(function (value) {
        getEdited.push(
          api.getLastEdited(value.padName)
              .then((resultObject) => {
                value.lastEdited = resultObject.lastEdited;
                resultObject = api.padUsersCount(value.padName);
                value.userCount = resultObject.padUsersCount;
              }));
      });
    } else {
      data.message = 'No results';
    }

    await Promise.all(getEdited);
    return data;
  },
};

exports.expressCreateServer = function (hook_name, args, cb) {
  args.app.get('/admin/pads', function (req, res) {
    let render_args = {
      errors: [],
    };
    res.send(eejs.require('ep_adminpads2/templates/admin/pads.html', render_args));
  });
  return cb();
};

let io = null;

exports.socketio = function (hook_name, args) {
  io = args.io.of('/pluginfw/admin/pads');
  io.on('connection', function (socket) {
    socket.on('load', async function (query) {
      let result = await pads.search({pattern: '', offset: 0, limit: queryLimit});
      socket.emit('search-result', result);
    });

    socket.on('search', async function (query) {
      let result = await pads.search(query);
      socket.emit('search-result', result);
    });

    socket.on('delete', async function (padId) {
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

exports.eejsBlock_adminMenu = function (hook_name, args, cb) {
  let hasAdminUrlPrefix = args.content.indexOf('<a href="admin/') !== -1,
      hasOneDirDown = args.content.indexOf('<a href="../') !== -1,
      hasTwoDirDown = args.content.indexOf('<a href="../../') !== -1,
      urlPrefix = hasAdminUrlPrefix ? 'admin/' : hasTwoDirDown ? '../../' : hasOneDirDown ? '../' : '';
  args.content = args.content + '<li><a href="' + urlPrefix + 'pads" data-l10n-id="ep_adminpads2_manage-pads">Manage pads</a></li>';
  return cb();
};
