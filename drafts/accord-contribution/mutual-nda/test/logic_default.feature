Feature: Mutual NDA
  This describes the expected behavior for a Mutual Non-Disclosure Agreement template

  Background:
    Given the default contract

  Scenario: The contract should parse with default values
    Then the contract data should include
"""
{
    "$class": "org.openagreements.nda.mutual.MutualNDAContract",
    "purpose": "evaluating a potential business relationship",
    "ndaTerm": "1 year",
    "confidentialityPeriod": "1 year",
    "governingLaw": "Delaware",
    "jurisdiction": "courts located in New Castle County, Delaware"
}
"""
