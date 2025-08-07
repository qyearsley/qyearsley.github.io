const tt = require("./truthtable")

describe("BoolExpr", () => {
  test("eval constant", () => {
    const expr = new tt.BoolExprConst(true)
    expect(expr.eval()).toEqual(true)
  })

  test("eval simple", () => {
    expect(
      new tt.BoolExprBinary("and", new tt.BoolExprConst(true), new tt.BoolExprConst(true)).eval()
    ).toEqual(true)
    expect(
      new tt.BoolExprBinary("and", new tt.BoolExprConst(false), new tt.BoolExprConst(true)).eval()
    ).toEqual(false)
    expect(
      new tt.BoolExprBinary("or", new tt.BoolExprConst(true), new tt.BoolExprConst(false)).eval()
    ).toEqual(true)
    expect(
      new tt.BoolExprBinary("or", new tt.BoolExprConst(false), new tt.BoolExprConst(false)).eval()
    ).toEqual(false)
  })

  test("eval complex", () => {
    expect(
      new tt.BoolExprBinary(
        "and",
        new tt.BoolExprConst(true),
        new tt.BoolExprBinary("or", new tt.BoolExprConst(false), new tt.BoolExprConst(false))
      ).eval()
    ).toEqual(false)
    expect(
      new tt.BoolExprBinary(
        "and",
        new tt.BoolExprConst(true),
        new tt.BoolExprBinary("or", new tt.BoolExprConst(true), new tt.BoolExprConst(false))
      ).eval()
    ).toEqual(true)
  })

  test("vars", () => {
    expect(new tt.BoolExprVar("asdf").vars()).toEqual(["asdf"])
  })

  test("vars with repetition", () => {
    expect(
      new tt.BoolExprBinary("and", new tt.BoolExprVar("a"), new tt.BoolExprVar("a")).vars()
    ).toEqual(["a"])
  })

  test("vas with two vars", () => {
    expect(
      new tt.BoolExprBinary("and", new tt.BoolExprVar("a"), new tt.BoolExprVar("b")).vars()
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

  test("equivalence", () => {
    expect(tt.parseInfix("true eq true").eval()).toEqual(true)
    expect(tt.parseInfix("true eq false").eval()).toEqual(false)
    expect(tt.parseInfix("false eq false").eval()).toEqual(true)
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
    expect(tt.tokenize("a and (b or c)")).toStrictEqual(["a", "and", "(", "b", "or", "c", ")"])
  })

  test("extra spaces", () => {
    expect(tt.tokenize(" a and ( b or c ) ")).toStrictEqual(["a", "and", "(", "b", "or", "c", ")"])
  })
})

describe("TruthTable", () => {
  test("simple", () => {
    expect(new tt.TruthTable("a and b").rows).toStrictEqual([
      ["a", "b", "a and b"],
      ["false", "false", "false"],
      ["false", "true", "false"],
      ["true", "false", "false"],
      ["true", "true", "true"],
    ])
  })
})
