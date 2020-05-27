/**
 * Adapted for PF1 system from original module: https://github.com/jopeek/fvtt-loot-sheet-npc-5e
 */ 

class GenerateCompendiumDialog extends Dialog {
  
  constructor(callback, options) {
    if (typeof(options) !== "object") {
      options = {};
    }
    
    let applyChanges = false;
    super({
      title: game.i18n.localize("tb.generateCompendiumTitle"),
      content: options.html,
      buttons: {
        generate: {
          label: game.i18n.localize("tb.generate"),
          dontclose: true,
          callback: (html) => this._generate(html)
        },
        cancel: {
          label: game.i18n.localize("tb.cancel")
        },
      },
      default: "generate",
      close: (dialog) => { console.log(dialog); }
    });
  }
  
  activateListeners(html) {
    super.activateListeners(html);
    
    // Detect and activate file-picker buttons
    html.find('button.file-picker').each((i, button) => this._activateFilePicker(button));
  }
  
  _activateFilePicker(button) {
    button.onclick = event => {
      event.preventDefault();
      FilePicker.fromButton(button).browse();
    }
  }
  
  _submit(button, html) {
    try {
      if (button.callback) button.callback(html);
      if (!button.dontclose) this.close();
    } catch(err) {
      ui.notifications.error(err);
      throw new Error(err);
    }
  }
  
  async _generate(html) {
    let source = html.find('input[name="source"]').val();
    let template = html.find('input[name="template"]').val();
    let entity = html.find('select[name="entity"]').val();
    
    if (entity != "Actor" && entity != "Item") {
      ui.notifications.error(game.i18n.localize("ERROR.tbInvalidEntity"));
      return;
    }

    if (source.length == 0) {
      ui.notifications.error(game.i18n.localize("ERROR.tbNoSource"));
    }
    else if (template.length == 0) {
      ui.notifications.error(game.i18n.localize("ERROR.tbNoTemplate"));
    }
    else {
      game.settings.set("data-toolbox", "source", source);
      game.settings.set("data-toolbox", "template", template);
      
      // load data (as CSV)
      let data;
      try {
        data = await d3.csv(source);
        console.log(data)
      } catch(err) {
        ui.notifications.error(game.i18n.localize("ERROR.tbInvalidCSV"));
        throw new Error(err);
      }
      
      // load template (as text)
      const tmpl = await d3.text(template);
      //console.log(tmpl)
        
      // delete compendium if exists
      let compendium = game.packs.get("world.toolbox-data");
      if (compendium) {
        await compendium.delete()
      }
      
      // create new compendium
      await Compendium.create({label: "Toolbox Data", entity: entity})
      const pack = await game.packs.find(p => p.metadata.label === "Toolbox Data");
      if (!pack) { return; }
      
      let jsonData = null;
      try {
        ui.notifications.info(game.i18n.localize("tb.processStarted"))
        for(let i=0; i<data.length; i++) {
          
          if (i % 50 == 0 && i != 0) {
            ui.notifications.info(game.i18n.format("tb.inProcess", {count: i, total: data.length}));
          }
          
          jsonData = this.format(tmpl, data[i]);
          //console.log(jsonData)
          let newData = JSON.parse(jsonData)
          //console.log(newData)
          let entity = await pack.createEntity(newData);
          entity.update({}); // force update to auto-calculate other data (e.g. totals)
        }
        ui.notifications.info(game.i18n.format("tb.processCompleted", {count: data.length, type: entity}));
      } catch(err) {
        ui.notifications.error(game.i18n.localize("ERROR.tbGenerationError"));
        console.log("Data Toolbox | JSON: " + jsonData);
        throw new Error(err);
      }
      
      //game.settings.set("data-toolbox", "template", template);
    }
  }
  
  format(text, data={}) {
    const fmt = /\{\{[^\}]+\}\}/g;
    text = text.replace(fmt, k => {
      return data[k.slice(2, -2)];
    });
    return text;
  }
}


Hooks.once("init", () => {

  console.log("Data Toolbox | Init")
  loadTemplates(["modules/data-toolbox/templates/dialog-toolbox.html"]);
  
  game.settings.register("data-toolbox", "source", { scope: "world", config: false, type: String });
  game.settings.register("data-toolbox", "template", { scope: "world", config: false, type: String });
});


function dtShowToolbox() {
  console.log("Data Toolbox | Show");
  
  renderTemplate("modules/data-toolbox/templates/dialog-toolbox.html", { source: game.settings.get("data-toolbox", "source"), template: game.settings.get("data-toolbox", "template")}).then(html => {
    (new GenerateCompendiumDialog(null, {html: html})).render(true);
  });
}
