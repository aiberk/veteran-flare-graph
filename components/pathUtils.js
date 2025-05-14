// pathUtils.js

export class Line {
  constructor(a, b) {
    this.a = a;
    this.b = b;
  }
  split() {
    const m = [(this.a[0] + this.b[0]) / 2, (this.a[1] + this.b[1]) / 2];
    return [new Line(this.a, m), new Line(m, this.b)];
  }
  toString() {
    return `M${this.a}L${this.b}`;
  }
}

export function BezierCurveFactory() {
  const l1 = [4 / 8, 4 / 8, 0, 0],
    l2 = [2 / 8, 4 / 8, 2 / 8, 0],
    l3 = [1 / 8, 3 / 8, 3 / 8, 1 / 8],
    r1 = [0, 2 / 8, 4 / 8, 2 / 8],
    r2 = [0, 0, 4 / 8, 4 / 8];

  function dot([ka, kb, kc, kd], { a, b, c, d }) {
    return [
      ka * a[0] + kb * b[0] + kc * c[0] + kd * d[0],
      ka * a[1] + kb * b[1] + kc * c[1] + kd * d[1]
    ];
  }

  return class BezierCurve {
    constructor(a, b, c, d) {
      this.a = a;
      this.b = b;
      this.c = c;
      this.d = d;
    }
    split() {
      const m = dot(l3, this);
      return [
        new BezierCurve(this.a, dot(l1, this), dot(l2, this), m),
        new BezierCurve(m, dot(r1, this), dot(r2, this), this.d)
      ];
    }
    toString() {
      return `M${this.a}C${this.b},${this.c},${this.d}`;
    }
  };
}

export class Path {
  constructor(segments = []) {
    this._ = segments;
    this._m = undefined;
  }
  moveTo(x, y) {
    this._ = [];
    this._m = [x, y];
  }
  lineTo(x, y) {
    this._.push(new Line(this._m, (this._m = [x, y])));
  }
  bezierCurveTo(ax, ay, bx, by, x, y) {
    this._.push(
      new (BezierCurveFactory())(
        this._m,
        [ax, ay],
        [bx, by],
        (this._m = [x, y])
      )
    );
  }
  *split(k = 0) {
    const n = this._.length,
      i = Math.floor(n / 2),
      j = Math.ceil(n / 2);
    const a = new Path(this._.slice(0, i)),
      b = new Path(this._.slice(j));
    if (i !== j) {
      const [ab, ba] = this._[i].split();
      a._.push(ab);
      b._.unshift(ba);
    }
    if (k > 1) {
      yield* a.split(k - 1);
      yield* b.split(k - 1);
    } else {
      yield a;
      yield b;
    }
  }
  toString() {
    return this._.join("");
  }
}
