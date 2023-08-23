# Tradeoffs

## 🚧 Disabled resources are no longer available

In order to stick to your budget, over-spending resources are disabled. This means they are no longer usable within your application, resulting in partial and/or complete unavailability, depending on the affected resources scope.

## 💰 Additional resources incur an additional cost

This library deploys additional resources, which incur additional costs. It is worth considering while setting your budget limit.

## 🏎️ Additional resources impact performances negatively

Some of the resources provisioned by this library have a negative impact on your application performance (e.g. Lambda cold start times are a bit longer due to the addition of a Layer).