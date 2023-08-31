# Expenses and budget computation

In order to [avoid floating point issue](https://floating-point-gui.de/), it is good practice to always try to stick with handling integers rather than decimals. It is commonly accepted in the industry to use a smaller non-fractionable unit, like ¢ instead of $ for US Dollars amounts, and therefore always handle integer representation of currency amounts.

In the case of AWS billing, most expenses increments cannot be expressed in ¢ using integers, those being much smaller than 1¢. For exemple, the added expenses resulting from an ARM 1-Go Lambda Function invocation for a duration of 1s is only 0.00168667¢. In order to cope with such small incremental currency amounts, it is important to use a smaller unit than ¢.

**Exemple billing models from AWS services**

| Designation                                                  | Price ($)     | Price (¢)   |
|--------------------------------------------------------------|---------------|-------------|
| AWS Lambda ARM 128MB pricing per ms                          | $0.0000000017 | 0.00000017¢ |
| Amazon API Gateway REST API pricing per call                 | $0.0000035    | 0.00035¢    |
| Amazon DynamoDB Standard-Infrequent Access On-Demand per WRU | $0.0000017669 | 0.00017669¢ |

This library uses ® - *revantios* - as currency unit with the following conversion rates

```
1® = 0.00000001¢ = $0.0000000001
```
**or**
```
10,000,000,000® = 100¢ = $1
```

**Exemple billing models from AWS services using revantios ®**

| Designation                                                  | Price ($)     | Price (®)|
|--------------------------------------------------------------|---------------|----------|
| AWS Lambda ARM 128MB pricing per ms                          | $0.0000000017 | 17®      |
| Amazon API Gateway REST API pricing per call                 | $0.0000035    | 35,000®  |
| Amazon DynamoDB Standard-Infrequent Access On-Demand per WRU | $0.0000017669 | 17,669®  |
