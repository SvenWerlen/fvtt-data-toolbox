/* Adapted from: https://github.com/zgrossbart/jdd  */
/*******************************************************************************
 *
 * Copyright 2015-2019 Zack Grossbart
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 ******************************************************************************/
'use strict';

/**
 * The jdd object handles all of the functions for the main page.  It finds the diffs and manages
 * the interactions of displaying them.
 */
/*global jdd:true */
var jdd = {

    LEFT: 'left',
    RIGHT: 'right',

    EQUALITY: 'eq',
    TYPE: 'type',
    MISSING: 'missing',
    diffs: [],
    requestCount: 0,

    /**
     * Fixing typeof
     * takes value and returns type of value
     * @param  value 
     * return typeof value
     */
    getType: function(value) {
      if ((function () { return value && (value !== this); }).call(value)) {
        //fallback on 'typeof' for truthy primitive values
        return typeof value;
      }
      return ({}).toString.call(value).match(/\s([a-z|A-Z]+)/)[1].toLowerCase();
    },
        
    /**
     * Add all child objects as missing (because parent is missing)
     */
    addChildAsMissingLeft: function(/*Object*/ data1, /*Object*/ config1, /*Object*/ data2, /*Object*/ config2, /*String*/ key) {
        if (jdd.getType(data1) === 'array') {
            data1.forEach(function (arrayVal, index) {
                config1.currentPath.push('/[' + index + ']');
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                                config2, jdd.generatePath(config2),
                                'Missing property <code>' + key + '</code> from the object on the left (inherited)', jdd.MISSING));
                jdd.addChildAsMissingLeft(arrayVal, config1, data2, config2, key)
                config1.currentPath.pop();
            });
        }
        else if (jdd.getType(data1) === 'object') {
            config1.currentPath.push('/');
            for (key in data1) {
                config1.currentPath.push(key);
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                            config2, jdd.generatePath(config2),
                            'Missing property <code>' + key + '</code> from the object on the left (inherited)', jdd.MISSING));
                jdd.addChildAsMissingLeft(data1[key], config1, data2, config2, key)
                config1.currentPath.pop();
            }
            config1.currentPath.pop();
        }
    },
    
    /**
     * Same as above but the right side
     */
    addChildAsMissingRight: function(/*Object*/ data1, /*Object*/ config1, /*Object*/ data2, /*Object*/ config2, /*String*/ key) {
        if (jdd.getType(data2) === 'array') {
            data2.forEach(function (arrayVal, index) {
                config2.currentPath.push('/[' + index + ']');
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                                config2, jdd.generatePath(config2),
                                'Missing property <code>' + key + '</code> from the object on the right (inherited)', jdd.MISSING));
                jdd.addChildAsMissingRight(data1, config1, arrayVal, config2, key)
                config2.currentPath.pop();
            });
        }
        else if (getType(data2) === 'object') {
            config2.currentPath.push('/');
            for (key in data1) {
                config2.currentPath.push(key);
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                            config2, jdd.generatePath(config2),
                            'Missing property <code>' + key + '</code> from the object on the right (inherited)', jdd.MISSING));
                jdd.addChildAsMissingRight(data1, config1, data2[key], config2, key)
                config2.currentPath.pop();
            }
            config2.currentPath.pop();
        }
    },
    
    /**
     * Find the differences between the two objects and recurse into their sub objects.
     */
    findDiffs: function (/*Object*/ config1, /*Object*/ data1, /*Object*/ config2, /*Object*/ data2) {
        config1.currentPath.push('/');
        config2.currentPath.push('/');

        var key;
        // no un-used vars
        // var val;

        if (data1.length < data2.length) {
            /*
             * This means the second data has more properties than the first.
             * We need to find the extra ones and create diffs for them.
             */
            for (key in data2) {
                if (data2.hasOwnProperty(key)) {
                    // no un-used vars
                    // val = data1[key];
                    if (!data1.hasOwnProperty(key)) {
                        jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                            config2, jdd.generatePath(config2, '/' + key),
                            'The right side of this object has more items than the left side', jdd.MISSING));
                    }
                }
            }
        }

        /*
         * Now we're going to look for all the properties in object one and
         * compare them to object two
         */
        for (key in data1) {
            if (data1.hasOwnProperty(key)) {
                // no un-used vars
                // val = data1[key];

                config1.currentPath.push(key);

                if (!data2.hasOwnProperty(key)) {
                    /*
                     * This means that the first data has a property which
                     * isn't present in the second data
                     */
                    jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                        config2, jdd.generatePath(config2),
                        'Missing property <code>' + key + '</code> from the object on the right side', jdd.MISSING));
                    jdd.addChildAsMissingLeft(data1[key], config1, data2, config2, key)
                } else {
                    config2.currentPath.push(key);

                    jdd.diffVal(data1[key], config1, data2[key], config2);
                    config2.currentPath.pop();
                }
                config1.currentPath.pop();
            }
        }

        config1.currentPath.pop();
        config2.currentPath.pop();

        /*
         * Now we want to look at all the properties in object two that
         * weren't in object one and generate diffs for them.
         */
        for (key in data2) {
            if (data2.hasOwnProperty(key)) {
                // no un-used vars
                // val = data1[key];

                if (!data1.hasOwnProperty(key)) {
                    jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                        config2, jdd.generatePath(config2, key),
                        'Missing property <code>' + key + '</code> from the object on the left side', jdd.MISSING));
                    config2.currentPath.push('/');
                    config2.currentPath.push(key);
                    jdd.addChildAsMissingRight(data1, config1, data2[key], config2, key)
                    config2.currentPath.pop();
                    config2.currentPath.pop();
                }
            }
        }
    },

    /**
     * Generate the differences between two values.  This handles differences of object
     * types and actual values.
     */
    diffVal: function (val1, config1, val2, config2) {

        if (jdd.getType(val1) === 'array') {
            jdd.diffArray(val1, config1, val2, config2);
        } else if (jdd.getType(val1) === 'object') {
            if (['array', 'string', 'number', 'boolean', 'null'].indexOf(jdd.getType(val2)) > -1) {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                    config2, jdd.generatePath(config2),
                    'Both types should be objects', jdd.TYPE));
            } else {
                jdd.findDiffs(config1, val1, config2, val2);
            }
        } else if (jdd.getType(val1) === 'string') {
            if (jdd.getType(val2) !== 'string') {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                    config2, jdd.generatePath(config2),
                    'Both types should be strings', jdd.TYPE));
            } else if (val1 !== val2) {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                    config2, jdd.generatePath(config2),
                    'Both sides should be equal strings', jdd.EQUALITY));
            }
        } else if (jdd.getType(val1) === 'number') {
            if (jdd.getType(val2) !== 'number') {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                    config2, jdd.generatePath(config2),
                    'Both types should be numbers', jdd.TYPE));
            } else if (val1 !== val2) {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                    config2, jdd.generatePath(config2),
                    'Both sides should be equal numbers', jdd.EQUALITY));
            }
        } else if (jdd.getType(val1) === 'boolean') {
            jdd.diffBool(val1, config1, val2, config2);
        } else if (jdd.getType(val1) === 'null' && jdd.getType(val2) !== 'null') {
            jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                config2, jdd.generatePath(config2),
                'Both types should be nulls', jdd.TYPE));
        }
    },

    /**
     * Arrays are more complex because we need to recurse into them and handle different length
     * issues so we handle them specially in this function.
     */
    diffArray: function (val1, config1, val2, config2) {
        if (jdd.getType(val2) !== 'array') {
            jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                config2, jdd.generatePath(config2),
                'Both types should be arrays', jdd.TYPE));
            return;
        }

        if (val1.length < val2.length) {
            /*
             * Then there were more elements on the right side and we need to
             * generate those differences.
             */
            for (var i = val1.length; i < val2.length; i++) {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                    config2, jdd.generatePath(config2, '[' + i + ']'),
                    'Missing element <code>' + i + '</code> from the array on the left side', jdd.MISSING));
            }
        }
        val1.forEach(function (arrayVal, index) {
            if (val2.length <= index) {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1, '[' + index + ']'),
                    config2, jdd.generatePath(config2),
                    'Missing element <code>' + index + '</code> from the array on the right side', jdd.MISSING));
                config1.currentPath.push('/[' + index + ']');
                jdd.addChildAsMissingLeft(arrayVal, config1, val2, config2, '[' + index + ']');
                config1.currentPath.pop();
            } else {
                config1.currentPath.push('/[' + index + ']');
                config2.currentPath.push('/[' + index + ']');

                if (jdd.getType(val2) === 'array') {
                    /*
                     * If both sides are arrays then we want to diff them.
                     */
                    jdd.diffVal(val1[index], config1, val2[index], config2);
                }
                config1.currentPath.pop();
                config2.currentPath.pop();
            }
        });
    },

    /**
     * We handle boolean values specially because we can show a nicer message for them.
     */
    diffBool: function (val1, config1, val2, config2) {
        if (jdd.getType(val2) !== 'boolean') {
            jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                config2, jdd.generatePath(config2),
                'Both types should be booleans', jdd.TYPE));
        } else if (val1 !== val2) {
            if (val1) {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                    config2, jdd.generatePath(config2),
                    'The left side is <code>true</code> and the right side is <code>false</code>', jdd.EQUALITY));
            } else {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                    config2, jdd.generatePath(config2),
                    'The left side is <code>false</code> and the right side is <code>true</code>', jdd.EQUALITY));
            }
        }
    },

    /**
     * Format the object into the output stream and decorate the data tree with
     * the data about this object.
     */
    formatAndDecorate: function (/*Object*/ config, /*Object*/ data) {
        if (jdd.getType(data) === 'array') {
            jdd.formatAndDecorateArray(config, data);
            return;
        }

        jdd.startObject(config);
        config.currentPath.push('/');

        var props = jdd.getSortedProperties(data);

        /*
         * If the first set has more than the second then we will catch it
         * when we compare values.  However, if the second has more then
         * we need to catch that here.
         */
        props.forEach(function (key) {
            config.out += jdd.newLine(config) + jdd.getTabs(config.indent) + '"' + jdd.unescapeString(key) + '": ';
            config.currentPath.push(key);
            config.paths.push({
                path: jdd.generatePath(config),
                line: config.line
            });
            jdd.formatVal(data[key], config);
            config.currentPath.pop();
        });

        jdd.finishObject(config);
        config.currentPath.pop();
    },

    /**
     * Format the array into the output stream and decorate the data tree with
     * the data about this object.
     */
    formatAndDecorateArray: function (/*Object*/ config, /*Array*/ data) {
        jdd.startArray(config);

        /*
         * If the first set has more than the second then we will catch it
         * when we compare values.  However, if the second has more then
         * we need to catch that here.
         */
        data.forEach(function (arrayVal, index) {
            config.out += jdd.newLine(config) + jdd.getTabs(config.indent);
            config.paths.push({
                path: jdd.generatePath(config, '[' + index + ']'),
                line: config.line
            });

            config.currentPath.push('/[' + index + ']');
            jdd.formatVal(arrayVal, config);
            config.currentPath.pop();
        });

        jdd.finishArray(config);
        config.currentPath.pop();
    },

    /**
     * Generate the start of the an array in the output stream and push in the new path
     */
    startArray: function (config) {
        config.indent++;
        config.out += '[';

        if (config.paths.length === 0) {
            /*
             * Then we are at the top of the array and we want to add
             * a path for it.
             */
            config.paths.push({
                path: jdd.generatePath(config),
                line: config.line
            });
        }

        if (config.indent === 0) {
            config.indent++;
        }
    },

    /**
     * Finish the array, outdent, and pop off all the path
     */
    finishArray: function (config) {
        if (config.indent === 0) {
            config.indent--;
        }

        jdd.removeTrailingComma(config);

        config.indent--;
        config.out += jdd.newLine(config) + jdd.getTabs(config.indent) + ']';
        if (config.indent !== 0) {
            config.out += ',';
        } else {
            config.out += jdd.newLine(config);
        }
    },

    /**
     * Generate the start of the an object in the output stream and push in the new path
     */
    startObject: function (config) {
        config.indent++;
        config.out += '{';

        if (config.paths.length === 0) {
            /*
             * Then we are at the top of the object and we want to add
             * a path for it.
             */
            config.paths.push({
                path: jdd.generatePath(config),
                line: config.line
            });
        }

        if (config.indent === 0) {
            config.indent++;
        }
    },

    /**
     * Finish the object, outdent, and pop off all the path
     */
    finishObject: function (config) {
        if (config.indent === 0) {
            config.indent--;
        }

        jdd.removeTrailingComma(config);

        config.indent--;
        config.out += jdd.newLine(config) + jdd.getTabs(config.indent) + '}';
        if (config.indent !== 0) {
            config.out += ',';
        } else {
            config.out += jdd.newLine(config);
        }
    },

    /**
     * Format a specific value into the output stream.
     */
    formatVal: function (val, config) {
        if (jdd.getType(val) === 'array') {
            config.out += '[';

            config.indent++;
            val.forEach(function (arrayVal, index) {
                config.out += jdd.newLine(config) + jdd.getTabs(config.indent);
                config.paths.push({
                    path: jdd.generatePath(config, '[' + index + ']'),
                    line: config.line
                });

                config.currentPath.push('/[' + index + ']');
                jdd.formatVal(arrayVal, config);
                config.currentPath.pop();
            });
            jdd.removeTrailingComma(config);
            config.indent--;

            config.out += jdd.newLine(config) + jdd.getTabs(config.indent) + ']' + ',';
        } else if (jdd.getType(val) === 'object') {
            jdd.formatAndDecorate(config, val);
        } else if (jdd.getType(val) === 'string') {
            config.out += '"' + jdd.unescapeString(val) + '",';
        } else if (jdd.getType(val) === 'number') {
            config.out += val + ',';
        } else if (jdd.getType(val) === 'boolean') {
            config.out += val + ',';
        } else if (jdd.getType(val) === 'null') {
            config.out += 'null,';
        }
    },

    /**
     * When we parse the JSON string we end up removing the escape strings when we parse it 
     * into objects.  This results in invalid JSON if we insert those strings back into the 
     * generated JSON.  We also need to look out for characters that change the line count 
     * like new lines and carriage returns.  
     * 
     * This function puts those escaped values back when we generate the JSON output for the 
     * well known escape strings in JSON.  It handles properties and values.
     *
     * This function does not handle unicode escapes.  Unicode escapes are optional in JSON 
     * and the JSON output is still valid with a unicode character in it.  
     */
    unescapeString: function (val) {
        if (val) {
            return val.replace('\\', '\\\\')    // Single slashes need to be replaced first
                .replace(/\"/g, '\\"')     // Then double quotes
                .replace(/\n/g, '\\n')     // New lines
                .replace('\b', '\\b')      // Backspace
                .replace(/\f/g, '\\f')     // Formfeed
                .replace(/\r/g, '\\r')     // Carriage return
                .replace(/\t/g, '\\t');    // Horizontal tabs
        } else {
            return val;
        }
    },

    /**
     * Generate a JSON path based on the specific configuration and an optional property.
     */
    generatePath: function (config, prop) {
        var s = '';
        config.currentPath.forEach(function (path) {
            s += path;
        });

        if (prop) {
            s += '/' + prop;
        }

        if (s.length === 0) {
            return '/';
        } else {
            return s;
        }
    },

    /**
     * Add a new line to the output stream
     */
    newLine: function (config) {
        config.line++;
        return '\n';
    },

    /**
     * Sort all the relevant properties and return them in an alphabetical sort by property key
     */
    getSortedProperties: function (/*Object*/ obj) {
        var props = [];

        for (var prop in obj) {
            if (obj.hasOwnProperty(prop)) {
                props.push(prop);
            }
        }

        props = props.sort(function (a, b) {
            return a.localeCompare(b);
        });

        return props;
    },

    /**
     * Generate the diff and verify that it matches a JSON path
     */
    generateDiff: function (config1, path1, config2, path2, /*String*/ msg, type) {
        if (path1 !== '/' && path1.charAt(path1.length - 1) === '/') {
            path1 = path1.substring(0, path1.length - 1);
        }

        if (path2 !== '/' && path2.charAt(path2.length - 1) === '/') {
            path2 = path2.substring(0, path2.length - 1);
        }
        var pathObj1 = config1.paths.find(function (path) {
            return path.path === path1;
        });
        var pathObj2 = config2.paths.find(function (path) {
            return path.path === path2;
        });

        if (!pathObj1) {
            throw 'Unable to find line number for (' + msg + '): ' + path1;
        }

        if (!pathObj2) {
            throw 'Unable to find line number for (' + msg + '): ' + path2;
        }

        return {
            path1: pathObj1,
            path2: pathObj2,
            type: type,
            msg: msg
        };
    },

    /**
     * Get the current indent level
     */
    getTabs: function (/*int*/ indent) {
        var s = '';
        for (var i = 0; i < indent; i++) {
            s += '    ';
        }

        return s;
    },

    /**
     * Remove the trailing comma from the output.
     */
    removeTrailingComma: function (config) {
        /*
         * Remove the trailing comma
         */
        if (config.out.charAt(config.out.length - 1) === ',') {
            config.out = config.out.substring(0, config.out.length - 1);
        }
    },

    /**
     * Create a config object for holding differences
     */
    createConfig: function () {
        return {
            out: '',
            indent: -1,
            currentPath: [],
            paths: [],
            line: 1
        };
    },

    /**
     * Format the output pre tags.
     */
    formatPRETags: function (text, className, id, showLineNumber = false) {
        var codeBlock = $('<pre class="codeBlock"></pre>');
        var lineNumbers = $('<div class="gutter"></div>');
        if(showLineNumber) {
          codeBlock.append(lineNumbers);
        }

        var codeLines = $('<div></div>');
        codeBlock.append(codeLines);

        var addLine = function (line, index) {
            var div = $('<div class="codeLine line' + (index + 1) + '"></div>');
            lineNumbers.append($('<span class="line-number">' + (index + 1) + '.</span>'));

            var span = $('<span class="code"></span');
            span.text(line);
            div.append(span);

            codeLines.append(div);
        };

        var lines = text.split('\n');
        lines.forEach(addLine);

        codeBlock.addClass(className);
        codeBlock.attr('id', id);

        return codeBlock;
    },

    /**
     * Process the specified diff
     */
    processDiffs: function (html1, html2) {
        let linesDone1 = []
        let linesDone2 = []
        jdd.diffs.forEach(function (diff) {
            let icon = diff.type == "missing" ? "plus" : "not-equal"  
            if( linesDone1.indexOf(diff.path1.line) < 0 ) {
              html1.find('div.line' + diff.path1.line + ' span.code').addClass(diff.type).addClass('diff').prepend(`<i class="fas fa-${icon}"></i>`); 
              linesDone1.push(diff.path1.line)
            }
            if( linesDone2.indexOf(diff.path2.line) < 0 ) {
              html2.find('div.line' + diff.path2.line + ' span.code').addClass(diff.type).addClass('diff').prepend(`<i class="fas fa-${icon}"></i>`);
              linesDone2.push(diff.path2.line)
            }
        });

        jdd.diffs = jdd.diffs.sort(function (a, b) {
            return a.path1.line - b.path1.line;
        });
        
        return [html1, html2]
    },

    /**
     * Validate the input against the JSON parser
     */
    validateInput: function (json, side) {
        try {
            jsl.parser.parse(json);
            return true;
        } catch (parseException) {
            return false;
        }
    },


    /**
     * Implement the compare button and complete the compare process
     */
    compare: function (json1, json2) {
        jdd.diffs = [];

        var config = jdd.createConfig();
        var config2 = jdd.createConfig();
 
        config.currentPath = [];
        config2.currentPath = [];
 
        jdd.formatAndDecorate(config, json1);
        jdd.formatAndDecorate(config2, json2);
        
        var out1 = jdd.formatPRETags(config.out, "left", "out");
        var out2 = jdd.formatPRETags(config2.out, "right", "out2");
        
        jdd.diffVal(json1, config, json2, config2);
        return jdd.processDiffs(out1, out2);
    }
};
