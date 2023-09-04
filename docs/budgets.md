# Budgets

All budget amounts defined in this library are using ¢ unit and are monthly budgets, following AWS billing periods.
In order to accuratly reflect accrued costs, two values are persisted throughout the month in the common DynamoDB cost table:
- accrued instant expenses, reflecting usage of a pay-per-use resource (think serverless pricing model - Lambda, API Gateway, SQS...)
- inccured futur expenses, reflecting usage of a reserved resource (think traditional pricing model - VPC, EC2, RDS...)

### Accrued instant expenses

Saved within the `accruedExpenses` field in each budget item in DynamoDB. Updated as frequently as possible. They used [Revantios unit](./revantios.md).

Similar to a position.

### Inccured futur expenses

Saved within the `inccuredExpensesRate` fied in each budget item in DynamoDB. Updated when a time-sensitive expense is added or removed for the stack. The persisted unit is [Revantios](./revantios.md)/second.

Similar to a speed.

## Budget update

Using the `ADD` statement from DynamoDB `UpdateExpresion`, within an `UpdateItem` operation. Returns the updated budget with the `UPDATED_NEM` clause. Ensures budget update operations are conflict-free (not performing update operations on client side, but on DynamoDB side directly).

If update is triggered by a pay-per-use resource, `accruedExpenses` are updated with instant expenses from that resource added with `inccuredExpensesRate` since last update operation.

> DynamoDB update expression: `ADD accruedExpenses newInstanceExpenses + (currentTimestamp - lastUpdateTimestamp) * inccuredExpensesRate`

If update is triggered by a time-sensitive resource, `accruedExpenses` are updated with `inccuredExpensesRate` since last update operation and then `inccuredExpensesRate` is updated to reflect the contribution of the new resource to this rate.

> DynamoDB update expression: `ADD accruedExpenses (currentTimestamp - lastUpdateTimestamp) * inccuredExpensesRate, ADD inccuredExpensesRate addedResourceExpensesRate`