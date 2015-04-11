/* truthtable.js
 * A collection of functions for generating truth tables.
 * Quinten Yearsley
 * Created c. 2008, edited very slightly in 2013.
*/

// TODO true and false can be represented as true and false,
// they don't have to be represented as 0 and 1.
// TODO 

/**
 * A list of operators and the functions that they correspond to.
 * TODO: It would be good if this could use operator strings of length > 1.
 * Might later include more functions.
*/
var OPERATIONS_BY_SYMBOL = {
	"=" : function (x, y) {return x == y},
	">" : function (x, y) {return !x || y},
	"<" : function (x, y) {return x || !y},
	"&" : function (x, y) {return x && y},
	"|" : function (x, y) {return x || y},
	"^" : function (x, y) {return (x || y) && !(x && y)},
	"!" : function (x) {return !x},
	"0" : function () {return 0},
	"1" : function () {return 1}
}

/**
 * A BoolExpr is either an atom or it is compound boolean function
 * made up of a boolean function and a list of BoolExpr objects.
 * TODO: Subclass atom and compound boolexpr?
 *
 * @constructor
 * @param {String} type "atom" if it's an atom
 * @param {String[]}
 * 
*/ 
function BoolExpr(type, args, func) {
	this.type = type;
	if (type == "atom") {
		this.value = args;
		this.func = null;
	}
	else {
		this.args = args;
		this.func = func;
	}
}

/**
 * Evaluate a BoolExpr.
 * Precondition: Each atom in the BoolExpr has a "value" attribute set to 0 or 1.
*/
BoolExpr.prototype.eval = function () {
	if (this.type == "atom")
		return this.value ? 1 : 0;
	else {
		var args = this.args;
		args = args.map (function (arg) {return arg.eval()});
		return this.func.apply(this, args) ? 1 : 0;
	}
}

// returns a list of the values of each unique atom in a BoolExpr
BoolExpr.prototype.getAtoms = function () {
	if (this.type == "atom") {
		return [this.value];
	} else {
		var result = [];
		for (var i = 0; i < this.args.length; i++) {
			result = result.concat(this.args[i].getAtoms());
		}
		return result.removeDuplicates();
	}
}

// converts a BoolExpr object to a string representation of it
// this function is implicitly used to show a BoolExpr object
// whenever it needs to be used as a string, i.e. concatenation
BoolExpr.prototype.toString = function () {
	if (this.type == "atom")
		return this.value.toString();
	else {
		if (this.args.length == 1)
			return "(" + this.type + this.args[0].toString () + ")";
		if (this.args.length == 2)
			return "(" + this.args[0].toString ()
				+ this.type + this.args[1].toString () + ")";
	}
}


// returns a boolexpr with each instance of some atom replaced with something
BoolExpr.prototype.replaceAtom = function (atom, replacement) {
	if (this.type == "atom") {
		if (this.value == atom)
			return new BoolExpr (this.type, replacement);
		else
			return this;
	}
	else {
		var args = this.args.map (function (arg) {
				return arg.replaceAtom (atom, replacement);
				});
		return new BoolExpr (this.type, args, this.func);
	}
}

// evaluates a BoolExpr object substituting each atom in an array
// with the corresponding value in another array
BoolExpr.prototype.evalWith = function (atoms, values) {
	var result = this;
	for (var i = 0; i < atoms.length; i++)
		result = result.replaceAtom (atoms[i], values[i]);
	return result.eval ();
}

// converts a string representing a bool expression to a BoolExpr object
String.prototype.toBoolExpr = function ()
{
	result = this;
	result = result.strip(/\s+/g);
	for (var depth = 0; depth <= result.maxDepth(); depth ++) {
		for (var op in OPERATIONS_BY_SYMBOL) {
			if (result.containsInDepth (op, depth)) {
				var args = result.splitAtFirstInDepth (op, depth);
				if (OPERATIONS_BY_SYMBOL[op].arity == 1)
					args = args.slice(1);
				args = args.map (function (arg) {return arg.toBoolExpr()});
				return new BoolExpr (op, args, OPERATIONS_BY_SYMBOL[op]);
			}
		}
	}
	return new BoolExpr ("atom", result.strip(/[()]/g));
}

// tests whether a string contains some substring
String.prototype.contains = function (str) {
	return this.indexOf (str) != -1
}

// finds the depth of nested parentheses of an index in a string
String.prototype.depthAt = function (index) {
	var depth = 0;
	for (var i = 0; i <= index; i++) {
		if (this.charAt (i) == "(") depth ++;
		if (this.charAt (i) == ")") depth --;
	}
	return depth;
}

// finds the depth for the mosted deeply nested nest of nesty nested parentheses
String.prototype.maxDepth = function () {
	var max = 0;
	for (var i = 0; i < this.length; i++) {
		var depthHere = this.depthAt (i);
		if (depthHere > max) max = depthHere;
	}
	return max;
}

// finds the index of the first match of a substring at in a paren nest depth
String.prototype.indexOfFirstInDepth = function (x, depth) {
	var index = this.indexOf (x);
	while (this.depthAt (index) != depth && index != -1)
		index = this.indexOf (x, index + 1);
	return index;
}

// splits a string at the first substring
// that occurs at some depth of nested parentheses
String.prototype.splitAtFirstInDepth = function (x, depth) {
	var index = this.indexOfFirstInDepth (x, depth);
	return [this.substring (0, index), this.substring (index + 1)];
}

// tests whether a string contains some substring at some depth
// of nested parentheses
String.prototype.containsInDepth = function (x, depth) {
	return this.indexOfFirstInDepth (x, depth) != -1;
}

/**
 * Remove all occurences of a substring or pattern from a string.
*/
String.prototype.strip = function(x) {
	return this.split(x).join("")
}

/**
 * Remove duplicate items from an array.
*/
Array.prototype.removeDuplicates = function () {
	var result = [];
	// Go through array backwards, so only later occurences are removed.
	for (var i = this.length - 1; i >= 0; i--) {
		if (!(this.indexOf(this[i]) < i && this.contains(this[i]))) {
			result.push(this[i]);
		}
	}
	return result.reverse(); // keep order same as original array
}

/**
 * Test whether an array contains some element.
*/
Array.prototype.contains = function(x) {
	return this.indexOf(x) != -1;
}

// Return an array of possible combinations of true/false values.
// TODO: this should probably not be called "combinations".
function combinations(n) {
	if (n == 0) {
		return [[]];
	} else {
		return combinations(n-1).prependToAll(0).concat(combinations(n-1).prependToAll(1));
	}
}

/**
 * Prepend something to each sublist in a list of lists.
*/
Array.prototype.prependToAll = function(x) {
	return this.map(function(sublist) {return [x].concat(sublist)});
}

/**
 * Make a DOM table element from a 2d array.
*/
Array.prototype.toDOMTable = function () {
	var table = document.createElement ("table");
	this.forEach(function(row) {
		var tr = document.createElement ("tr");
		row.forEach(function(col) {
			var td = document.createElement ("td");
			td.appendChild(document.createTextNode (col));
			tr.appendChild(td);
		});
		table.appendChild(tr);
	});
	return table;
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
		var atoms = [], exprs = [], combs = [], evals = [];	
	}
	this.atoms = atoms;
	this.exprs = exprs;
	this.combs = combs;
	this.evals = evals;
}

// converts a TruthTable object to a 2d array
TruthTable.prototype.to2DArray = function() {
	var titles = this.atoms.concat(this.exprs);
	var rows = [];
	for (var i = 0; i < this.combs.length; i++) {
		rows[i] = this.combs[i].concat(this.evals[i]);
	}
	return [titles].concat(rows);
}

/**
 * Add a BoolExpr to a TruthTable.
*/
TruthTable.prototype.add = function(boolExpr) {
	var atoms = this.atoms.concat(boolExpr.getAtoms()).removeDuplicates();
	var exprs = this.exprs.concat([boolExpr]);
	var combs = combinations(atoms.length);
	var evals = combs.map(function(comb) {
			return exprs.map(function(expr) {
				return expr.evalWith (atoms, comb);
				});
			});
	return new TruthTable (atoms, exprs, combs, evals);
}

/**
 * Parse the string, make a truth table, and return it as a DOM table.
*/
function genTable(boolExprStr) {
	var table = new TruthTable();
	var expr = boolExprStr.toBoolExpr();
	table = table.add(expr);
	return table.to2DArray().toDOMTable();
}


// takes string with substrings representing bool expressions (premises)
// and another string representing a bool expression (conclusion)
// returns an object with 2 properties: "table", a DOM table,
// and "status", DOM text node
function test(premises, conclusion) {
	var table = new TruthTable;
	premises.split("\n").concat([conclusion]).forEach (function (str) {
			table = table.add (str.toBoolExpr());
			});
	isValid = table.evals.every (function (eval) {
			if (eval[eval.length - 1])
				return eval.every (function (x) {return x});
			else
				return true;
			});
	table = table.to2DArray().toDOMTable();
	var status = (isValid) ? "The conclusion is valid." : "The conclusion is invalid.";
	status = document.createTextNode(status);
	return {"table":table, "status":status};
}

