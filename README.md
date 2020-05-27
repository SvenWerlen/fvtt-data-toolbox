# Data Toolbox for Foundry

This module provides tools for generating compendium based on structured data.

**Typical use case**: 
 * Import data from https://www.d20pfsrd.com

 
![Compendiums](/doc/img/macro.jpg)

*The module also includes data samples for testing purposes.* 

### Install module

To install the module, follow these instructions:

1. Start FVTT and browse to the Game Modules tab in the Configuration and Setup menu
2. Select the Install Module button and enter the following URL: https://raw.githubusercontent.com/svenwerlen/fvtt-data-toolbox/master/module.json
3. Click Install and wait for installation to complete 

### Use data toolbox

* The module provides a compendium with a macro
* Open the `Data macros` compendium
* Import the `Show Toolbox` and execute it
  * As source file, browse or enter the following path: `modules/data-toolbox/samples/bestiary-sample.csv`
  * As template file, browse or enter the following path: `modules/data-toolbox/samples/creature-template.json`
  * Choose `Actor` as entity type
* Click on `Generate compendium` button
* Wait until process is completed (99 creatures)
* Take a look at the newly created compendium "Toolbox Data"

### How does it work?

The utility reads the input file, line by line, and generates an entry into the compendium by using the provided template.

It requires data (*source file*) to be structured and stored using [CSV format](https://en.wikipedia.org/wiki/Comma-separated_values).
* The data must be clean
* The header (first record) must exist and provide column names

See: [samples/bestiary-sample.csv](samples/bestiary-sample.csv)

It requires a template in JSON format with variables matching headers from the CSV file. In the example below, `{{Name}}` will be replaced by the value of the column `Name` from the input file.

```
{
  "name": "{{Name}}",
  "type": "npc",
  "data": {}
}
```

See: [samples/creature-template.json](samples/creature-template.json)
