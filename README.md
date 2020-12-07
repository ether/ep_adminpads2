# Administrate Etherpads
===========

![Screen shot](docs/img/preview.png)

Etherpad plugin for admins to list, search, and delete pads. The route
is `admin/pads`.

New in Version 3.0.1:
- New columns: pad Size, Revisions
- Pads are sorted: Deafault sorting: Last Edited, descending
  All columns can be sorted decsending or ascending by clicking on column headers
- Animated "Loading.." Icon


To be Done:
- Currently up to 35,000 pads can be handled. On re-sorting PpadManager.listAllPads() ist called again.
  This should only happen a single time on startup.
- Automatic Updates on pad changes don't work and the checkbox has been temporarily disabled.

This is a fork of
[ep_adminpads2](https://github.com/ether/ep_adminpads2), which has no sorting capabilities

[ep_adminpads](https://github.com/spcsser/ep_adminpads), which is no
longer maintained.
