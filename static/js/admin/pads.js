exports.documentReady = async (hookName, context) => {
  if (context !== 'admin/pads') {
    return;
  }

  var socket,
      loc = document.location,
      port = loc.port == '' ? (loc.protocol == 'https:' ? 443 : 80) : loc.port,
      url = loc.protocol + '//' + loc.hostname + ':' + port + '/',
      pathComponents = location.pathname.split('/'),
      // Strip admin/plugins
      baseURL = pathComponents.slice(0, pathComponents.length - 2).join('/') + '/',
      resource = baseURL.substring(1) + 'socket.io';

  var room = url + 'pluginfw/admin/pads';

  var changeTimer;

  //connect
  socket = io.connect(room, {path: baseURL + 'socket.io', resource: resource});

  $('#search-results').data('query', {
    pattern: '',
    offset: 0,
    limit: 12,
  });

  var doUpdate = false;
  var doAutoUpdate = () => $('#results-autoupdate').prop('checked');

  var search = () => {
    clearTimeout(changeTimer);
    socket.emit('search', $('#search-results').data('query'));
  };

  var htmlEntities = (padName) => $('<div/>').text(padName).html();

  var submitSearch = () => {
    var query = $('#search-results').data('query');
    query.pattern = $('#search-query')[0].value;
    query.offset = 0;
    search();
  };

  var isInt = (input) => typeof input === 'number' && input % 1 === 0;

  var formatDate = (longtime) => {
    var formattedDate = '';
    if (longtime != null && isInt(longtime)) {
      var date = new Date(longtime);
      var month = date.getMonth() + 1;
      formattedDate = date.getFullYear() + '-' + fillZeros(month) + '-' + fillZeros(date.getDate()) + ' ' + fillZeros(date.getHours()) + ':' + fillZeros(date.getMinutes()) + ':' + fillZeros(date.getSeconds());
    }
    return formattedDate;
  };

  var fillZeros = (x) => isInt(x) ? (x < 10 ? '0' + x : x) : '';

  const updateHandlers = () => {
    $('#progress.dialog .close').off('click').click(() => $('#progress.dialog').hide());

    $('#search-form').off('submit').on('submit', (e) => {
      e.preventDefault();
      submitSearch();
    });

    $('#do-search').off('click').click(submitSearch);

    $('#search-query').off('change paste keyup').on('change paste keyup', (e) => {
      clearTimeout(changeTimer);
      changeTimer = setTimeout(() => {
        e.preventDefault();
        submitSearch();
      }, 500);
    });

    $('.do-delete').off('click').click((e) => {
      var row = $(e.target).closest('tr');
      var padID = row.find('.padname').text();
      if (confirm(_('ep_adminpads2_confirm', {padID: padID}) || `Do you really want to delete the pad ${padID}?`)) {
        doUpdate = true;
        socket.emit('delete', padID);
      }
    });

    $('#do-prev-page').off('click').click((e) => {
      var query = $('#search-results').data('query');
      query.offset -= query.limit;
      if (query.offset < 0) {
        query.offset = 0;
      }
      search();
    });
    $('#do-next-page').off('click').click((e) => {
      var query = $('#search-results').data('query');
      var total = $('#search-results').data('total');
      if (query.offset + query.limit < total) {
        query.offset += query.limit;
      }
      search();
    });
  }

  updateHandlers();

  socket.on('progress', (data) => {
    $('#progress .close').hide();
    $('#progress').show();

    $('#progress').data('progress', data.progress);

    const message = $('<span>');
    if (data.isError) {
      message.addClass('error');
      message.text(_(data.messageId) || _('ep_adminpads2_unknown-error') || 'Unknown error');
    } else {
      message.addClass('status');
      message.text(_(data.messageId) || _('ep_adminpads2_unknown-status') || 'Unknown status');
    }
    $('#progress .message').empty().append(message);

    if (data.progress >= 1) {
      if (data.isError) {
        $('#progress').show();
      } else {
        if (doUpdate || doAutoUpdate()) {
          doUpdate = false;
          search();
        }
        $('#progress').hide();
      }
    }
  });

  socket.on('search-result', (data) => {
    var widget = $('#search-results'),
        limit = data.query.offset + data.query.limit;
    if (limit > data.total) {
      limit = data.total;
    }

    widget.data('query', data.query);
    widget.data('total', data.total);

    widget.find('.offset').html(data.query.offset);
    widget.find('.limit').html(limit);
    widget.find('.total').html(data.total);

    widget.find('#results *').remove();
    var resultList = widget.find('#results');

    if (data.results.length > 0) {
      data.results.forEach((resultset) => {
        var padName = resultset.padName;
        var lastEdited = resultset.lastEdited;
        var userCount = resultset.userCount;
        var row = widget.find('#template tr').clone();
        row.find('.padname').html('<a href="../p/' + encodeURIComponent(padName) + '">' + htmlEntities(padName) + '</a>');
        row.find('.last-edited').html(formatDate(lastEdited));
        row.find('.user-count').html(userCount);
        resultList.append(row);
      });
    } else {
      const noResults = _('ep_adminpads2_no-results') || 'No results';
      resultList.append(
          $('<tr>').append(
              $('<td>')
                  .attr('colspan', '4')
                  .addClass('no-results')
                  .text(noResults)));
    }

    updateHandlers();
  });

  socket.emit('load');
  search();
  return;
};
