const fs = require("fs");
const path = require("path");
const F = require("fortissimo");

type recipe = {
  title: string;
  utensils: string[];
  ingredients: any;
  method: string[];
};

//TODO File path
const file = path.join(__dirname, "cookbook/index.rcp");

var recipe: recipe;
function main(): void {
  try {
    recipe = parseRecipe(fs.readFileSync(file).toString());
  } catch (err) {
    error("PARSE ERROR", err);
  }

  console.log(`\x1b[3mPreparing '${recipe.title}'...\x1b[0m`);
  try {
    followRecipe();
  } catch (err) {
    error("RUNTIME ERROR", err);
  }

  // Check for any unused ingredients, utensils
  //TODO Check for unused utensils
  for (var i in recipe.ingredients) {
    if (recipe.ingredients[i] === undefined) {
      throw `Unused ingredient <${i}>`;
    }
  }

  console.log();
}
main();

// Handle generic error
function error(type: string, msg: string): void {
  console.error(`\n\x1b[31;1m${type}\x1b[0m\n\x1b[31m${msg}\x1b[0m\n`);
  process.exit();
}

// Run method
function followRecipe(): void {
  var repeats = 0;

  for (var i = 0; i < recipe.method.length; i++) {
    //TODO Secondary try/catch for line number
    var step = splitAtSpace(recipe.method[i]),
      cmd = step[0].toLowerCase();

    // Preheat
    if (i === 0 && cmd !== "preheat") {
      throw "You forgot to preheat the oven!";
    }
    if (i > 0 && cmd === "preheat") {
      throw "You must preheat the oven on the first step only!";
    }

    // Remove condition from args
    //TODO 'until'
    var condition: string[] = null,
      args = [];
    for (var j = 1; j < step.length; j++) {
      if (step[j].toLowerCase() === "if") {
        condition = [];
        continue;
      }
      if (condition) {
        condition.push(step[j]);
        continue;
      }
      args.push(step[j]);
    }

    // Check condition
    if (condition && !checkCondition(condition)) {
      continue;
    }

    switch (cmd) {
      // Ignore
      case "preheat":
      case "dont":
      case "don't":
        break;

      // Print value
      case "shout":
        shoutArgs(args);
        break;

      // Add, append, or concat value
      case "add":
        var from = args[0],
          select = "contents",
          rest = 1;
        if (args[1]?.toLowerCase() === "of") {
          from = args[2];
          select = args[0].toLowerCase();
          rest += 2;
        }
        var to = args[rest + 1];
        if (args[rest]?.toLowerCase() !== "to") {
          throw "Cannot add to nothing";
        }

        switch (select) {
          // Read file
          case "file":
            //TODO Error handling
            if (!recipe.utensils.includes("fs")) {
              throw "'File reader' utensil was not specified!";
            }
            addValue(
              to,
              fs
                .readFileSync(path.join(file, "../", parseValue(from)))
                .toString(),
            );
            break;

          // Whole value
          case "contents":
            addValue(to, parseValue(from));
            if (isValidIngredient(from)) {
              recipe.ingredients[from] = null;
            }
            break;

          // Random item / number
          case "any":
            var value = parseValue(from);
            if (value === null || value === undefined) {
              throw "Cannot get 'any' of null";
            }
            if (typeof value === "number") {
              // Random number
              var number = F.randomInt(0, value);
              addValue(to, number);
              if (isValidIngredient(from)) {
                recipe.ingredients[from] -= number;
              }
            } else {
              // Random item
              var number = F.randomInt(0, value.length);
              addValue(to, value[number] || "");
              if (isValidIngredient(from)) {
                if (typeof value === "string") {
                  recipe.ingredients[from] =
                    value.slice(0, number) + value.slice(number + 1);
                } else {
                  recipe.ingredients[from] = [
                    ...value.slice(0, number),
                    ...value.slice(number + 1),
                  ];
                }
              }
            }
            break;

          // First item
          case "first":
            var value = parseValue(from);
            if (value === null || value === undefined) {
              throw "Cannot get 'first' of null";
            }
            if (typeof value === "number") {
              throw "Cannot get 'first' of number";
            }
            addValue(to, value[0] || "");
            if (isValidIngredient(from)) {
              recipe.ingredients[from] = value.slice(1);
            }
            break;

          // Last item
          case "last":
            var value = parseValue(from);
            if (value === null || value === undefined) {
              throw "Cannot get 'last' of null";
            }
            if (typeof value === "number") {
              throw "Cannot get 'last' of number";
            }
            addValue(to, value.slice(-1)[0] || "");
            if (isValidIngredient(from)) {
              recipe.ingredients[from] = value.slice(0, -1);
            }
            break;

          default:
            throw `Unknown selector <${select}>`;
        }
        break;

      // Clone ingredient without deleting original
      case "remake":
        var from = args[0],
          as = args[2];
        if (args[1]?.toLowerCase() !== "as") {
          throw "Cannot remake as nothing";
        }
        if (!isValidIngredient(as)) {
          throw `Undefined ingredient <${as}>`;
        }
        recipe.ingredients[as] = parseValue(from);
        break;

      // Split ingredient to list
      case "separate":
        var value = parseValue(args[0]),
          char = parseValue(args[2]);
        if (args[1]?.toLowerCase() !== "by") {
          throw "Separation method not given";
        }
        if (!(typeof value === "string" || typeof value === "number")) {
          throw `Cannot separate type <${typeof value}>`;
        }
        recipe.ingredients[args[0]] = value.toString().split(char);
        break;

      // Delete ingredient, set to null
      case "empty":
        if (!isValidIngredient(args[0])) {
          throw `Undefined ingredient <${args[0]}>`;
        }
        recipe.ingredients[args[0]] = null;
        break;

      // Move to line (previous)
      case "repeat":
        if (args.slice(0, 2).join(" ") !== "from step") {
          throw "Unknown format for 'repeat'";
        }
        if (isNaN(parseInt(args[2]))) {
          throw "Step is not a number";
        }
        //! Higher amount
        if (repeats >= 20) {
          throw "Too many repeats!";
        }
        i = parseInt(args[2]) - 1;
        repeats++;

        break;

      // Final shout and exit
      case "serve":
        if (args.length > 0) {
          process.stdout.write("\x1b[3m");
          if (args[0]?.toLowerCase() === "and") {
            // Assume all is one string
            shoutArgs(["'" + args.slice(1).join(" ") + "'"]);
          } else {
            // Assume type defined
            shoutArgs(args);
          }
          process.stdout.write("\x1b[0m\n");
        }
        process.exit();

      case "take":
        var take = args[0],
          rest = 1;
        //TODO parseValue for a if not 'of size'
        if (args[1]?.toLowerCase() === "of") {
          if (args[0]?.toLowerCase() === "size") {
            take = getSize(condition[2]);
            rest += 2;
          }
        }
        if (args[rest]?.toLowerCase() !== "from") {
          throw "Cannot take from nothing";
        }
        var from = args[rest + 1];
        if (!isValidIngredient(from)) {
          throw `Undefined ingredient <${from}>`;
        }
        var value = parseValue(from);
        if (typeof value !== "number") {
          throw "Ingredient is not a number";
        }
        recipe.ingredients[from] -= take;
        break;

      default:
        throw `Unknown command <${step[0]}>`;
    }
  }
}

// Shout all arguments
function shoutArgs(args: string[]): void {
  process.stdout.write(
    splitAtArgs(args.join(" "))
      .map(i => {
        if (i?.toLowerCase() === "everything") {
          return JSON.stringify(recipe.ingredients, null, 2);
        }
        return printValue(parseValue(i));
      })
      .join(""),
  );
}

// Add (concat, add, push) 2 values
function addValue(name: string, value: any): void {
  if (!isValidIngredient(name)) {
    throw `Undefined ingredient <${name}>`;
  }
  if (value === null || value === undefined) {
    return;
  }

  var original = parseValue(name);
  if (original === null || original === undefined) {
    recipe.ingredients[name] = value;
    return;
  }

  switch ((typeof original)[0] + (typeof value)[0]) {
    case "ss":
      recipe.ingredients[name] += value;
      break;
    case "sn":
      recipe.ingredients[name] = original.length + value;
      break;
    // (so) invalid

    case "ns":
      recipe.ingredients[name] += value.length;
      break;
    case "nn":
      recipe.ingredients[name] += value;
      break;
    // (no) invalid

    case "os":
    case "on":
      recipe.ingredients[name].push(value);
      break;
    case "oo":
      recipe.ingredients[name].push(...value);
      break;

    default:
      throw `Cannot add values of type <${typeof original}> and <${typeof value}>`;
  }
}

// Check full condition line, separate with 'and'
function checkCondition(full: string[]): boolean {
  var conditions = [];
  var build = [];
  //TODO ,r'
  for (var i = 0; i < full.length; i++) {
    if (full[i]?.toLowerCase() === "and") {
      conditions.push(build);
      build = [];
      continue;
    }
    build.push(full[i]);
  }
  conditions.push(build);
  return !conditions.map(checkSingleCondition).includes(false);
}

// Check single condition of line
function checkSingleCondition(condition: string[]): boolean {
  var a: any = condition[0],
    b: any = condition.slice(-1)[0],
    inverse = false,
    rest = 1;

  //TODO Move to function
  // 'of'
  if (condition[rest]?.toLowerCase() === "of") {
    if (a?.toLowerCase() === "size") {
      a = getSize(condition[rest + 1]);
      rest += 2;
    }
  }

  // 'is' type
  if (condition[rest]?.toLowerCase() === "is") {
    rest++;

    // Check for inverse 'not'
    if (condition[rest]?.toLowerCase() === "not") {
      inverse = true;
      rest++;
    }

    // 'empty' (null, empty string, zero)
    if (condition[rest]?.toLowerCase() === "empty") {
      return !parseValue(a) !== inverse;
    }

    var method = null;
    if (
      condition
        .slice(rest, rest + 3)
        ?.join(" ")
        ?.toLowerCase() === "the same as"
    ) {
      method = "==";
      rest += 3;
    } else if (
      condition
        .slice(rest, rest + 2)
        ?.join(" ")
        ?.toLowerCase() === "less than"
    ) {
      method = "<";
      rest += 2;
    } else if (
      condition
        .slice(rest, rest + 2)
        ?.join(" ")
        ?.toLowerCase() === "more than"
    ) {
      method = ">";
      rest += 2;
    } else if (condition[rest]?.toLowerCase() === "in") {
      method = "in";
      rest += 1;
    }

    // 'of'
    if (condition[rest + 1]?.toLowerCase() === "of") {
      if (condition[rest]?.toLowerCase() === "size") {
        b = getSize(condition[rest + 2]);
      }
    }
    // console.log(recipe.ingredients);
    // console.log(condition, a, b, method);

    if (method) {
      switch (method) {
        case "==":
          return (parseValue(a) == parseValue(b)) !== inverse;
        case "<":
          return parseValue(a) < parseValue(b) !== inverse;
        case ">":
          return parseValue(a) > parseValue(b) !== inverse;
        case "in":
          return (
            (!parseValue(b) || parseValue(b)?.includes(parseValue(a))) !==
            inverse
          );
      }
    }
  }

  throw `Unknown condition <${condition.join(" ")}>`;
}

// Remove spaces before / after
function removePadding(string: string): string {
  return string.replace(/^ *| *$/g, "");
}

// Convert string to type
function parseValue(string: string): any {
  if (string?.startsWith?.("'") && string?.endsWith?.("'")) {
    return string.slice(1, -1);
  }
  if (!isNaN(parseInt(string))) {
    return parseInt(string);
  }
  if (string === "wait") {
    return "\n";
  }
  if (string === "line") {
    return "\r\n";
  }
  if (string === "empty") {
    return null;
  }
  if (string === "warning") {
    return "\x1b[33;1mWarning!\x1b[0m";
  }
  if (string === "mistake") {
    return "\x1b[37;41;1mMistake!\x1b[0m";
  }
  if (isValidIngredient(string)) {
    return recipe.ingredients[string];
  }
  //* Debug
  if (
    string?.startsWith("^") &&
    isValidIngredient(string?.toLowerCase()?.slice(1))
  ) {
    var value = recipe.ingredients[string?.toLowerCase()?.slice(1)];
    if (typeof value === "string") {
      return value.toUpperCase();
    }
    return value;
  }
  throw `Unknown type or ingredient <${string}>`;
}

// Get size of any value
function getSize(value: any): number {
  value = parseValue(value);
  if (typeof value === "number") {
    return value;
  }
  return value?.length || 0;
}

// Format value to printable string
function printValue(value: any, iter = 0): string {
  // String
  if (typeof value === "string") {
    return value;
  }
  // Number
  if (typeof value === "number") {
    return "\x1b[33m" + value.toString() + "\x1b[0m";
  }
  // Array
  if (value?.constructor === Array) {
    if (value.length < 1) {
      return "[]";
    }

    var items = value.map(i => printValue(i, iter + 1));
    // One line
    if (items.join(", ").length < 15) {
      return "[ " + items.join(", ") + " ]";
    }
    // Multiple lines
    return (
      "[\n" +
      items.map(i => "  ".repeat(iter) + i).join(",\n") +
      "\n" +
      "  ".repeat(iter - 1) +
      "]"
    );
  }
  // Empty (null)
  return "\x1b[1mEmpty\x1b[0m";
}

// Check if ingredient is defined
function isValidIngredient(string: string): boolean {
  return Object.keys(recipe.ingredients).includes(string);
}

// Split string at space without breaking quotes
function splitAtSpace(string: string): string[] {
  var array: string[] = [],
    build = "",
    isQuote = false;

  for (var i = 0; i < string.length; i++) {
    if (string[i] === "'") {
      if (isQuote || "., ".includes(build.slice(-1)[0])) {
        isQuote = !isQuote;
      }
    }

    if (string[i] === " ") {
      if (!isQuote) {
        if (build) {
          array.push(build);
        }
        build = "";
        continue;
      }
    }

    build += string[i];
  }
  if (build) {
    array.push(build);
  }

  return array;
}

// Split string at comma or 'and' without breaking quotes
function splitAtArgs(string: string): string[] {
  var array: string[] = [],
    build = "",
    isQuote = false;

  for (var i = 0; i < string.length; i++) {
    if (string[i] === "'") {
      isQuote = !isQuote;
    }

    if (string[i] === ",") {
      if (!isQuote) {
        if (build) {
          array.push(removePadding(build));
        }
        build = "";
        continue;
      }
    }

    if (string[i]) build += string[i];
  }
  if (build) {
    array.push(removePadding(build));
  }

  //TODO Handle different cases
  var last = splitAtSpace(array.slice(-1)[0]);
  for (var i = 0; i < last.length; i++) {
    if (last[i].toLowerCase() === "and") {
      array.pop();
      array.push(...last.slice(0, i));
      array.push(...last.slice(i + 1));
    }
  }

  return array;
}

// Parse recipe file to object
function parseRecipe(file: string): recipe {
  var lines = file.split("\r\n");

  var recipe = {
    title: null,
    utensils: null,
    ingredients: null,
    method: null,
  };

  // Sort file
  var stepNumber = 0;
  for (var i = 0; i < lines.length; i++) {
    var line = removePadding(lines[i]);
    if (!line) {
      continue;
    }

    // Recipe
    if (!recipe.title) {
      recipe.title = line;
      continue;
    }

    // Start utensils
    if (line.toLowerCase().startsWith("utensils")) {
      if (!recipe.utensils) {
        recipe.utensils = [];
        continue;
      } else {
        throw `Utensils already defined (line ${i + 1})`;
      }
    }

    // Start ingredients
    if (line.toLowerCase().startsWith("ingredients")) {
      if (!recipe.ingredients) {
        recipe.ingredients = [];
        continue;
      } else {
        throw `Ingredients already defined (line ${i + 1})`;
      }
    }

    // Start method
    if (line.toLowerCase().startsWith("method")) {
      if (!recipe.method) {
        recipe.method = [];
        continue;
      } else {
        throw `Method already defined (line ${i + 1})`;
      }
    }

    // Method item
    if (recipe.method) {
      if (line.split(".").length > 1) {
        var number = parseInt(line.split(".")[0]);
        if (isNaN(number)) {
          throw `Step does not have a number (line ${i + 1})`;
        }
        stepNumber++;
        if (number !== stepNumber) {
          //! Zero is for debugging
          if (number !== 0) {
            throw `Invalid step number (line ${i + 1})`;
          }
          stepNumber--;
        }
        var step = removePadding(line.split(".").slice(1).join("."));
        if (!step.endsWith(".")) {
          throw `Missing '.' after step (line ${i + 1})`;
        }
        recipe.method.push(step.slice(0, -1));
        continue;
      }
    }

    // Ingredients item
    if (recipe.ingredients) {
      if (line.startsWith("- 1")) {
        recipe.ingredients.push(removePadding(line.slice(3).toLowerCase()));
        continue;
      }
    }

    // Utensils item
    if (recipe.utensils) {
      if (line.startsWith("- 1")) {
        var utensil = {
          "file reader": "fs",
          "input interface": "io",
        }[removePadding(line.slice(3).toLowerCase())];

        if (!utensil) {
          throw `Unknown utensil (line ${i + 1})`;
        }
        recipe.utensils.push(utensil);
        continue;
      }
    }

    throw `Unknown line format (line ${i + 1})`;
  }

  // Format ingredients
  var ingredients: any = {};
  for (var i = 0; i < recipe.ingredients.length; i++) {
    var item = recipe.ingredients[i].split(" ");
    if (item.length === 1) {
      ingredients[item[0]] = undefined;
      continue;
    }
    if (item.length === 3 && item[1] === "of") {
      ingredients[item[2]] = parseValue(item[0]);
      continue;
    }
    throw `Unknown ingredient format <${item.join(" ")}>`;
  }
  recipe.ingredients = ingredients;

  return recipe;
}
