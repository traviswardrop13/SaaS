# Actual SDK storefront projection check

Uses public StoreKit1 synthetic fixtures wrapped in the actual locally built RevenueCat 5.80.3 SDK (revision `8969bf1feaca2cc9efaa7630cd148cec5005f2f8`). It checks 18 price/period/SKU/intro eligibility/preview-isolation cases. The process runs with all outbound networking denied. It never configures RevenueCat, uses a live account, opens Apple's purchase/restore sheet, or reads Sona's real preferences.

First run the existing donor `revenuecat-identity-harness` to obtain its verified local SDK stage, and build/test `modules/SonaFamilyStorefront`. Then pass the resulting paths:

```sh
python3 native/family-ios/revenuecat-storefront-harness/run.py \
  --sdk-stage /private/tmp/sona-rc-identity-EXAMPLE \
  --modules /path/to/storefront/build/out/Products/Debug
```

The runner writes only to a fresh `/private/tmp` folder by default. No remote dependency resolution occurs. The existing SDK stage is read only. This checks SDK public-object mapping and compile compatibility; it does not prove live App Store purchases, refunds, eligibility/account configuration, in-place upgrade, or sandbox receipt behavior.

A real regression was reproduced before the correction: a valid StoreKit1 monthly product was rejected because that SDK's `productType` is always its default type for StoreKit1. The same monthly fixture passed after validating public product category plus the exact subscription period. Neither metadata nor any billing threshold was weakened.
