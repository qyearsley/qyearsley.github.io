/**
 * truthtable.js
 *
 * A collection of functions for generating truth tables.
 * Quinten Yearsley
 * Originally created c. 2008.
 */

"use strict"

// TODO true and false can be represented as true and false,
// they don't have to be represented as 0 and 1.

/**
 * A list of operators and the functions that they correspond to.
 * FIXME: Allow operator strings of length > 1.
 * Might later include more functions.
 */
const OPERATIONS_BY_SYMBOL = {
  "=": function (x, y) {
    return x == y
  },
  ">": function (x, y) {
    return !x || y
  },
  "<": function (x, y) {
    return x || !y
  },
  "&": function (x, y) {
    return x && y
  },
  "|": function (x, y) {
    return x || y
  },
  "^": function (x, y) {
    return (x || y) && !(x && y)
  },
  "!": function (x) {
    return !x
  },
  0: function () {
    return 0
  },
  1: function () {
    return 1
  },
}

/**
 * A BoolExpr is either an atom or it is compound boolean function
 * made up of a boolean function and a list of BoolExpr objects.
 * FIXME: Make Atom and CompoundBoolExpr subclasses?
 *
 * @constructor
 */
function BoolExpr(type, args, func) {
  this.type = type
  if (type == "atom") {
    this.value = args
    this.func = null
  } else {
    this.args = args
    this.func = func
  }
}

/**
 * Evaluate a BoolExpr.
 * Precondition: Each atom in the BoolExpr has a "value" attribute set to 0 or 1.
 */
BoolExpr.prototype.eval = function () {
  if (this.type == "atom") {
    return this.value ? 1 : 0
  } else {
    let args = this.args
    args = args.map(function (arg) {
      return arg.eval()
    })
    return this.func.apply(this, args) ? 1 : 0
  }
}

// returns a list of the values of each unique atom in a BoolExpr
BoolExpr.prototype.getAtoms = function () {
  if (this.type == "atom") {
    return [this.value]
  } else {
    let result = []
    for (let a of this.args) {
      result = result.concat(a.getAtoms())
    }
    return result.removeDuplicates()
  }
}

// Converts a BoolExpr object to a string representation of it.
// This function is implicitly used to show a BoolExpr object
// whenever it needs to be used as a string, i.e. concatenation.
BoolExpr.prototype.toString = function () {
  if (this.type == "atom") {
    return this.value.toString()
  } else {
    if (this.args.length == 1) {
      return "(" + this.type + this.args[0].toString() + ")"
    }
    if (this.args.length == 2) {
      return (
        "(" +
        this.args[0].toString() +
        this.type +
        this.args[1].toString() +
        ")"
      )
    }
  }
}

// Returns a BoolExpr with each instance of some atom replaced with something.
BoolExpr.prototype.replaceAtom = function (atom, replacement) {
  if (this.type == "atom") {
    if (this.value == atom) {
      return new BoolExpr(this.type, replacement)
    } else {
      return this
    }
  } else {
    let args = this.args.map(function (arg) {
      return arg.replaceAtom(atom, replacement)
    })
    return new BoolExpr(this.type, args, this.func)
  }
}

// Evaluates a BoolExpr object substituting each atom in an array
// with the corresponding value in another array.
BoolExpr.prototype.evalWith = function (atoms, values) {
  let result = this
  for (var i = 0; i < atoms.length; i++) {
    result = result.replaceAtom(atoms[i], values[i])
  }
  return result.eval()
}

// converts a string representing a bool expression to a BoolExpr object
String.prototype.toBoolExpr = function () {
  var result = this
  result = result.strip(/\s+/g)
  for (var depth = 0; depth <= result.maxDepth(); depth++) {
    for (var op in OPERATIONS_BY_SYMBOL) {
      if (result.containsInDepth(op, depth)) {
        var args = result.splitAtFirstInDepth(op, depth)
        if (OPERATIONS_BY_SYMBOL[op].arity == 1) {
          args = args.slice(1)
        }
        args = args.map(function (arg) {
          return arg.toBoolExpr()
        })
        return new BoolExpr(op, args, OPERATIONS_BY_SYMBOL[op])
      }
    }
  }
  return new BoolExpr("atom", result.strip(/[()]/g))
}

// tests whether a string contains some substring
String.prototype.contains = function (str) {
  return this.indexOf(str) != -1
}

// Finds the depth of nested parentheses of an index in a string.
String.prototype.depthAt = function (index) {
  var depth = 0
  for (var i = 0; i <= index; i++) {
    if (this.charAt(i) == "(") {
      depth++
    }
    if (this.charAt(i) == ")") {
      depth--
    }
  }
  return depth
}

// Finds the depth for the most deeply nested nest of nesty nested parentheses.
String.prototype.maxDepth = function () {
  var max = 0
  for (var i = 0; i < this.length; i++) {
    var depthHere = this.depthAt(i)
    if (depthHere > max) {
      max = depthHere
    }
  }
  return max
}

// Finds the index of the first match of a substring at in a paren nest depth.
String.prototype.indexOfFirstInDepth = function (x, depth) {
  var index = this.indexOf(x)
  while (this.depthAt(index) != depth && index != -1) {
    index = this.indexOf(x, index + 1)
  }
  return index
}

// Splits a string at the first substring
// that occurs at some depth of nested parentheses.
String.prototype.splitAtFirstInDepth = function (x, depth) {
  var index = this.indexOfFirstInDepth(x, depth)
  return [this.substring(0, index), this.substring(index + 1)]
}

// Tests whether a string contains some substring at some depth
// of nested parentheses.
String.prototype.containsInDepth = function (x, depth) {
  return this.indexOfFirstInDepth(x, depth) != -1
}

/**
 * Remove all occurrences of a substring or pattern from a string.
 */
String.prototype.strip = function (x) {
  return this.split(x).join("")
}

/**
 * Remove duplicate items from an array.
 */
Array.prototype.removeDuplicates = function () {
  var result = []
  // Go through array backwards, so only later occurrences are removed.
  for (var i = this.length - 1; i >= 0; i--) {
    if (!(this.indexOf(this[i]) < i && this.contains(this[i]))) {
      result.push(this[i])
    }
  }
  return result.reverse() // keep order same as original array
}

/**
 * Test whether an array contains some element.
 */
Array.prototype.contains = function (x) {
  return this.indexOf(x) != -1
}

// Return an array of possible combinations of true/false values.
// FIXME: Rename this.
function combinations(n) {
  if (n == 0) {
    return [[]]
  } else {
    return combinations(n - 1)
      .prependToAll(0)
      .concat(combinations(n - 1).prependToAll(1))
  }
}

/**
 * Prepend something to each sublist in a list of lists.
 */
Array.prototype.prependToAll = function (x) {
  return this.map(function (sublist) {
    return [x].concat(sublist)
  })
}

/**
 * Make a DOM table element from a 2d array.
 */
Array.prototype.toDOMTable = function () {
  var table = document.createElement("table")
  this.forEach(function (row) {
    var tr = document.createElement("tr")
    row.forEach(function (col) {
      var td = document.createElement("td")
      td.appendChild(document.createTextNode(col))
      tr.appendChild(td)
    })
    table.appendChild(tr)
  })
  return table
}

/**
 * TruthTable object constructor. there are four parts:
 *   a list of unique atoms
 *   a list of BoolExpr objects
 *   a list of combinations of truth values of each atom
 *   a list of evaluations of each prop for each combination
 */
function TruthTable(atoms, exprs, combs, evals) {
  if (arguments.length == 0) {
    let atoms = []
    let exprs = []
    let combs = []
    let evals = []
  }
  this.atoms = atoms
  this.exprs = exprs
  this.combs = combs
  this.evals = evals
}

/**
 * converts a TruthTable object to a 2d array.
 */
TruthTable.prototype.to2DArray = function () {
  let titles = this.atoms.concat(this.exprs)
  let rows = []
  for (var i = 0; i < this.combs.length; i++) {
    rows[i] = this.combs[i].concat(this.evals[i])
  }
  return [titles].concat(rows)
}

/**
 * Add a BoolExpr to a TruthTable.
 */
TruthTable.prototype.add = function (boolExpr) {
  let atoms = this.atoms.concat(boolExpr.getAtoms()).removeDuplicates()
  let exprs = this.exprs.concat([boolExpr])
  let combs = combinations(atoms.length)
  let evals = combs.map(function (comb) {
    return exprs.map(function (expr) {
      return expr.evalWith(atoms, comb)
    })
  })
  return new TruthTable(atoms, exprs, combs, evals)
}

/**
 * Parse the string, make a truth table, and return it as a DOM table.
 */
function genTable(boolExprStr) {
  let table = new TruthTable()
  let expr = boolExprStr.toBoolExpr()
  table = table.add(expr)
  let domTable = table.to2DArray().toDOMTable()
  domTable.setAttribute("border", "1")
  return domTable
}

// Takes a string with substrings representing bool expressions (premises)
// and another string representing a bool expression (conclusion)
// returns an object with 2 properties: "table", a DOM table,
// and "status", DOM text node
function test(premises, conclusion) {
  var table = new TruthTable()
  premises
    .split("\n")
    .concat([conclusion])
    .forEach(function (str) {
      table = table.add(str.toBoolExpr())
    })
  var isValid = table.evals.every(function (e) {
    if (e[e.length - 1]) {
      return e.every(function (x) {
        return x
      })
    } else {
      return true
    }
  })
  table = table.to2DArray().toDOMTable()
  let status = 'The conclusion is ' + (isValid ? 'valid.' : 'invalid.');
  status = document.createTextNode(status)
  return { table: table, status: status }
}
