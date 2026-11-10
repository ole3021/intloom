# Order total

A Code-only Loom with integer prices, a quantity default of `1`, and a numeric
result. It needs no model, Workflow, acceptance evaluator or credentials.

With the framework installed in this directory or a parent directory:

```sh
intloom dev build
intloom loom describe ./dist/order-total-1.0.0.tgz
intloom install ./dist/order-total-1.0.0.tgz
intloom run order-total@1.0.0 --input '{"prices":[19,23]}'
```

The first run connects to the local Kernel or starts it automatically.
For an author trial, `intloom dev test --input '{"prices":[19,23]}'` executes the built archive directly.
The output is `42`. Supplying `"quantity":2` returns `84`. The author package
version is independent of the framework's version. Before framework publication,
use the provided candidate's tarball overrides instead of a registry install.
