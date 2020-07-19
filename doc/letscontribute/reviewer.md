# Let's Contribute - Reviewer

This page presents how designated reviewers can accept/reject and review contributions.

*Go back to [Data Toolbox | Let's Contribute](README.md) for a global overview.*

## Prerequisites

You need to administrate a Foundry VTT installation and be a reviewer for at least one system/module.
* The owner of the system/module must contact me on Discord (Dorgendubal#3348) and request for reviewers
  * You'll then get an access key
  * You must enter the credentials in the *Data Toolbox* section of the configurations

![Login details](/doc/img/letscontribute-login.jpg)

## Review contributions

* To review contributions, simply execute the macro from the *Data Toolbox* compendium.

![Review entries](/doc/img/letscontribute-review.jpg)

### Compare changes

The first action lets you compare changes between the submitted data and the entry from the original compendium.

![Compare changes](/doc/img/letscontribute-compare.jpg)

Initiatives can filter the data to focus on specific part, facilitating the comparison. The example below
is based on an initiative that filters `data.changes` and `data.contextNotes` only.

![Compare changes](/doc/img/letscontribute-compare-filtered.jpg)

### Import changes

The second action lets you import the submitted entry into the *Items Directory*. 
If the entry is associated with an initiative, the designated parts will be extracted and merged with the original
entry. In the above example,  only `data.changes` and `data.contextNotes` will be merged from the submitted entry. 
The rest of the data will be from the entry from the original compendium.

### Accept / reject / delete changes

The last 3 actions let you take action on the submitted entry. 
* **Accept** means that you want that contribution being merged into the original compendium
* **Reject** means that you don't want that contribution to be merged but will let an admin eventually reconsider it.
* **Delete** means that you consider that contribution as being a mistake and you want to delete it from the server

By executing any of these actions, the entry will disappear from the list

## Good to know

* If you want to accept the submitted entry but fix something before doing it, you can:
  * Import it
  * Fix the problem or improve the contribution
  * Submit it
  * Review and accept the newly submitted entry
  * Delete the other one
