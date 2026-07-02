-- seed.sql — baseline categories + jurisdiction defaults (staging/prod-safe)

insert into categories (slug, name, description, age_restricted, jurisdiction_sensitive, sort) values
 ('hemp-flower','Hemp Flower','Federally compliant hemp flower with batch-linked COAs.', true, true, 1),
 ('cbd-flower','CBD Flower','CBD-dominant hemp flower cultivars.', true, true, 2),
 ('cbg-flower','CBG Flower','CBG-dominant hemp flower cultivars.', true, true, 3),
 ('thca-flower','THCA Flower','THCA hemp flower — availability varies by jurisdiction.', true, true, 4),
 ('pre-rolls','Hemp Pre-Rolls','Pre-rolled hemp flower products.', true, true, 5),
 ('thc-drinks','Hemp-Derived THC Drinks','Hemp-derived THC beverages.', true, true, 6),
 ('gummies','Gummies','Hemp-derived cannabinoid gummies.', true, true, 7),
 ('edibles','Edibles','Hemp-derived edible products.', true, true, 8),
 ('vapes','Vapes','Hemp-derived vaporizer products.', true, true, 9),
 ('concentrates','Concentrates','Hemp-derived concentrates.', true, true, 10),
 ('tinctures','Tinctures','Cannabinoid tinctures and oils.', true, true, 11),
 ('cbn-sleep','CBN Sleep Products','CBN-forward sleep support products.', true, true, 12),
 ('wellness','Wellness Products','Hemp wellness products.', false, false, 13),
 ('pet-products','Pet Products','Hemp products formulated for pets.', false, false, 14),
 ('accessories','Accessories','Storage, grinders, and smoking accessories.', false, false, 15),
 ('wholesale','Wholesale Products','Bulk and wholesale hemp supply.', true, true, 16),
 ('private-label','Private Label','Private-label manufacturing offers.', true, true, 17),
 ('manufacturer-direct','Manufacturer Direct','Direct from verified manufacturers.', true, true, 18),
 ('farm-direct','Farm Direct','Direct from verified hemp farms.', true, true, 19),
 ('retailer-offers','Retailer Offers','Offers from verified retail stores.', true, true, 20);

-- Launch geography: US + CA lanes; cross-border cannabinoid deny-by-default
insert into jurisdiction_rules (country, region, category_id, cannabinoid, effect, cross_border, notice) values
 ('US', null, null, null, 'allow', false, null),
 ('CA', null, null, null, 'allow', false, null),
 ('US', null, null, null, 'deny',  true,  'Cross-border cannabinoid orders are not available.'),
 ('CA', null, null, null, 'deny',  true,  'Cross-border cannabinoid orders are not available.');

-- Example destination restriction pattern (admins manage the real matrix):
-- THCA flower notice for a restricted state
insert into jurisdiction_rules (country, region, category_id, cannabinoid, effect, cross_border, notice)
select 'US','ID', id, 'thca', 'deny', false,
  'This product cannot be shipped to Idaho. It remains visible for research purposes.'
from categories where slug = 'thca-flower';

insert into age_gate_policies (country, region, category_class, min_age) values
 ('US', null, 'cannabinoid', 21),
 ('CA', null, 'cannabinoid', 21);
