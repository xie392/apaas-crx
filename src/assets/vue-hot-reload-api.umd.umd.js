;(function (c) {
  typeof define == "function" && define.amd ? define(c) : c()
})(function () {
  "use strict"
  let c, f
  const o = Object.create(null)
  typeof window < "u" && (window.__VUE_HOT_MAP__ = o)
  let a = !1,
    d = "beforeCreate"
  ;(exports.install = (n, r) => {
    if (
      !a &&
      ((a = !0),
      (c = n.__esModule ? n.default : n),
      (f = c.version.split(".").map(Number)),
      c.config._lifecycleHooks.indexOf("init") > -1 && (d = "init"),
      (exports.compatible = f[0] >= 2),
      !exports.compatible)
    ) {
      console.warn(
        "[HMR] You are using a version of vue-hot-reload-api that is only compatible with Vue.js core ^2.0.0."
      )
      return
    }
  }),
    (exports.createRecord = (n, r) => {
      if (o[n]) return
      let e = null
      typeof r == "function" && ((e = r), (r = e.options)),
        l(n, r),
        (o[n] = { Ctor: e, options: r, instances: [] })
    }),
    (exports.isRecorded = (n) => typeof o[n] < "u")
  function l(n, r) {
    if (r.functional) {
      const e = r.render
      r.render = (t, i) => {
        const s = o[n].instances
        return i && s.indexOf(i.parent) < 0 && s.push(i.parent), e(t, i)
      }
    } else
      u(r, d, function () {
        const e = o[n]
        e.Ctor || (e.Ctor = this.constructor), e.instances.push(this)
      }),
        u(r, "beforeDestroy", function () {
          const e = o[n].instances
          e.splice(e.indexOf(this), 1)
        })
  }
  function u(n, r, e) {
    const t = n[r]
    n[r] = t ? (Array.isArray(t) ? t.concat(e) : [t, e]) : [e]
  }
  function p(n) {
    return (r, e) => {
      try {
        n(r, e)
      } catch (t) {
        console.error(t),
          console.warn(
            "Something went wrong during Vue component hot-reload. Full reload required."
          )
      }
    }
  }
  function y(n, r) {
    for (const e in n) e in r || delete n[e]
    for (const e in r) n[e] = r[e]
  }
  ;(exports.rerender = p((n, r) => {
    const e = o[n]
    if (!r) {
      e.instances.slice().forEach((t) => {
        t.$forceUpdate()
      })
      return
    }
    if ((typeof r == "function" && (r = r.options), e.Ctor))
      (e.Ctor.options.render = r.render),
        (e.Ctor.options.staticRenderFns = r.staticRenderFns),
        e.instances.slice().forEach((t) => {
          ;(t.$options.render = r.render),
            (t.$options.staticRenderFns = r.staticRenderFns),
            t._staticTrees && (t._staticTrees = []),
            Array.isArray(e.Ctor.options.cached) &&
              (e.Ctor.options.cached = []),
            Array.isArray(t.$options.cached) && (t.$options.cached = [])
          const i = C(t)
          t.$forceUpdate(), t.$nextTick(i)
        })
    else if (
      ((e.options.render = r.render),
      (e.options.staticRenderFns = r.staticRenderFns),
      e.options.functional)
    ) {
      if (Object.keys(r).length > 2) y(e.options, r)
      else {
        const t = e.options._injectStyles
        if (t) {
          const i = r.render
          e.options.render = (s, h) => (t.call(h), i(s, h))
        }
      }
      ;(e.options._Ctor = null),
        Array.isArray(e.options.cached) && (e.options.cached = []),
        e.instances.slice().forEach((t) => {
          t.$forceUpdate()
        })
    }
  })),
    (exports.reload = p((n, r) => {
      const e = o[n]
      if (r)
        if ((typeof r == "function" && (r = r.options), l(n, r), e.Ctor)) {
          f[1] < 2 && (e.Ctor.extendOptions = r)
          const t = e.Ctor.super.extend(r)
          ;(t.options._Ctor = e.options._Ctor),
            (e.Ctor.options = t.options),
            (e.Ctor.cid = t.cid),
            (e.Ctor.prototype = t.prototype),
            t.release && t.release()
        } else y(e.options, r)
      e.instances.slice().forEach((t) => {
        t.$vnode && t.$vnode.context
          ? t.$vnode.context.$forceUpdate()
          : console.warn(
              "Root or manually mounted instance modified. Full reload required."
            )
      })
    }))
  function C(n) {
    if (!n._u) return
    const r = n._u
    return (
      (n._u = (e) => {
        try {
          return r(e, !0)
        } catch {
          return r(e, null, !0)
        }
      }),
      () => {
        n._u = r
      }
    )
  }
})
