$(() => {
  let query = {
    pattern: '',
    offset: 0,
    limit: 12,
  };
  let total;

  const basePath = location.pathname.split('/').slice(0, -2).join('/'); // Strip /admin/plugins.
  const socketioPath = `${basePath}/socket.io`;
  // Note: The socket.io URL should not contain ${basePath} because the path part of this URL is
  // used as the socket.io namespace.
  const socketioUrl = `${location.protocol}//${location.host}/pluginfw/admin/pads`;

  const socket = io.connect(socketioUrl, {path: socketioPath});

  let changeTimer;

  let doUpdate = false;
  const doAutoUpdate = () => $('#results-autoupdate').prop('checked');

  const search = () => {
    clearTimeout(changeTimer);
    socket.emit('search', query);
  };

  const submitSearch = () => {
    query.pattern = $('#search-query')[0].value;
    query.offset = 0;
    search();
  };

  const isInt = (input) => typeof input === 'number' && input % 1 === 0;

  const formatDate = (longtime) => {
    return (new Date(longtime)).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'long',
    });
  };

  const fillZeros = (x) => isInt(x) ? (x < 10 ? '0' + x : x) : '';

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
      const row = $(e.target).closest('tr');
      const padID = row.find('.padname').text();
      if (confirm(_('ep_adminpads2_confirm', {padID: padID}) ||
                  `Do you really want to delete the pad ${padID}?`)) {
        doUpdate = true;
        socket.emit('delete', padID);
      }
    });

    $('#do-prev-page').off('click').click((e) => {
      query.offset -= query.limit;
      if (query.offset < 0) query.offset = 0;
      search();
    });
    $('#do-next-page').off('click').click((e) => {
      if (query.offset + query.limit < total) {
        query.offset += query.limit;
      }
      search();
    });
  };

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
    let limit = data.query.offset + data.query.limit;
    if (limit > data.total) {
      limit = data.total;
    }

    query = data.query;
    total = data.total;

    $('#offset').text(query.offset);
    $('#limit').text(limit);
    $('#total').text(total);

    if (data.results.length > 0) {
      $('#loading').hide();
      $('#no-results').hide();
      $('#error').hide();
      const resultList = $('#results').empty();
      data.results.forEach((resultset) => {
        const {padName, lastEdited, userCount} = resultset;
        const row = $('#template').clone().removeAttr('id');
        row.find('.padname').empty().append(
            $('<a>').attr('href', `../p/${encodeURIComponent(padName)}`).text(padName));
        row.find('.last-edited').text(formatDate(lastEdited));
        row.find('.user-count').text(userCount);
        resultList.append(row);
      });
      $('#pad-widget').show();
    } else {
      $('#loading').hide();
      $('#pad-widget').hide();
      $('#error').hide();
      $('#no-results').show();
    }

    updateHandlers();
  });

  socket.on('search-error', (err) => {
    $('#loading').hide();
    $('#pad-widget').hide();
    $('#no-results').hide();
    $('#error-title')
        .attr('data-l10n-id', 'ep_adminpads2_search-error-title')
        .text('Failed to get pad list');
    $('#error-explanation')
        .attr('data-l10n-id', 'ep_adminpads2_search-error-explanation')
        .text('The server encountered an error while searching for pads:');
    $('#error-message').text(err.toString());
    $('#error').show();
  });

  socket.emit('load');
});
