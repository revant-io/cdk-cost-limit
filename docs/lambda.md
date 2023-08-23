# AWS Lambda

```ts
import { Function } from "@revant-io/cdk-cost-limit";

const fn = new Function(this, 'MyFunction', {
  /* The budget allocated to this resource in $US cents.
   * For exemple, if you want to set a budget of $1,00
   * for a specific Lambda function, you should used
   * a value of 100 for this prop.
   */
  budget: 100
});
```