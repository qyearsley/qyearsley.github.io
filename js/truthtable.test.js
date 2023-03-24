const tt = require("./truthtable")

describe("BoolExpr", () => {
  const BE = tt.BoolExpr

  test("constructor", () => {
    const expr = new BE("const", true)
    expect(expr.type).toEqual("const")
    expect(expr.arg1).toEqual(true)
    expect(expr.arg2).toBe(undefined)
  })

  test("eval constant", () => {
    const expr = new BE("const", true)
    expect(expr.eval()).toEqual(true)
  })

  test("eval simple", () => {
    expect(new BE("and", new BE("const", true), new BE("const", true)).eval()).toEqual(true)
    expect(new BE("and", new BE("const", false), new BE("const", true)).eval()).toEqual(false)
    expect(new BE("or", new BE("const", true), new BE("const", false)).eval()).toEqual(true)
    expect(new BE("or", new BE("const", false), new BE("const", false)).eval()).toEqual(false)
  })

  test("invalid operator", () => {
    expect(() => new BE("asdf", true, true).eval()).toThrow()
  })

  test("missing second argument", () => {
    expect(() => new BE("and", new BE("const", true)).eval()).toThrow()
  })

  test("variable that is not a string", () => {
    expect(() => new BE("var", 1).eval()).toThrow()
  })

  test("eval complex", () => {
    expect(
      new BE("and", new BE("const", true), new BE("or", new BE("const", false), new BE("const", false))).eval()
    ).toEqual(false)
    expect(
      new BE("and", new BE("const", true), new BE("or", new BE("const", true), new BE("const", false))).eval()
    ).toEqual(true)
  })

  test("getVars", () => {
    expect(
      new BE("var", "asdf").getVars()
    ).toEqual(["asdf"])
  })

  test("getVars with repetition", () => {
    expect(
      new BE("and", new BE("var", "a"), new BE("var", "a")).getVars()
    ).toEqual(["a"])
  })

  test("getVars with two vars", () => {
    expect(
      new BE("and", new BE("var", "a"), new BE("var", "b")).getVars()
    ).toEqual(["a", "b"])
  })
})

describe("parseInfix", () => {
  test("constant", () => {
    expect(tt.parseInfix("true").eval()).toEqual(true)
    expect(tt.parseInfix("false").eval()).toEqual(false)
  })

  test("simple", () => {
    expect(tt.parseInfix("true and false").eval()).toEqual(false)
    expect(tt.parseInfix("true and true").eval()).toEqual(true)
    expect(tt.parseInfix("true or false").eval()).toEqual(true)
    expect(tt.parseInfix("false or false").eval()).toEqual(false)   
  })

  test("compound", () => {
    expect(tt.parseInfix("(true and false) or true").eval()).toEqual(true)
    expect(tt.parseInfix("not (true and false) and false").eval()).toEqual(false)
  })

  test("not", () => {
    expect(tt.parseInfix("not true").eval()).toEqual(false)
    expect(tt.parseInfix("not false").eval()).toEqual(true)
    expect(tt.parseInfix("(not true) and false").eval()).toEqual(false)
    expect(tt.parseInfix("not (true and false)").eval()).toEqual(true)
  })

  test("parentheses", () => {
    expect(tt.parseInfix("((true))").eval()).toEqual(true)
    expect(tt.parseInfix("(true and false)").eval()).toEqual(false)
  })
})

describe("tokenize", () => {
  test("empty", () => {
    expect(tt.tokenize("")).toStrictEqual([])
  })

  test("one", () => {
    expect(tt.tokenize("a ")).toStrictEqual(["a"])
    expect(tt.tokenize("(")).toStrictEqual(["("])
    expect(tt.tokenize("( ")).toStrictEqual(["("])
    expect(tt.tokenize("true")).toStrictEqual(["true"])
  })

  test("parentheses", () => {
    expect(tt.tokenize("a and (b or c)")).toStrictEqual(
        ["a", "and", "(", "b", "or", "c", ")"])
  })

  test("extra spaces", () => {
    expect(tt.tokenize(" a and ( b or c ) ")).toStrictEqual(
        ["a", "and", "(", "b", "or", "c", ")"])
  })
})

describe("makeTable", () => {
  test("simple and expression", () => {
    expect(new tt.TruthTable("and a b").getRows()).toStrictEqual([
      ["a", "b", "and a b"],
      [false, false, false],
      [false, true, false],
      [true, false, false],
      [true, true, true],
    ])
  })
})

describe("combinations", () => {
  test("empty", () => {
    expect(tt.combinations(0)).toStrictEqual([[]])
  })

  test("length one", () => {
    expect(tt.combinations(1)).toStrictEqual([[false], [true]])
  })

  test("length two", () => {
    expect(tt.combinations(2)).toStrictEqual([
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ])
  })
})

