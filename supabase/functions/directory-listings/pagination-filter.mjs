const SEARCH_COLUMNS = Object.freeze(["display_name", "specialty", "taxonomy_specialty", "phone", "secondary_phone", "address", "governorate", "district", "village"]);

export function sanitizeDirectoryPaginationSearch(value) {
  return String(value ?? "").slice(0, 100).replace(/[^\p{L}\p{N}\s+-]/gu, " ").replace(/\s+/g, " ").trim();
}

export function buildDirectoryPaginationOrFilter(searchValue, cursor) {
  const search = sanitizeDirectoryPaginationSearch(searchValue);
  const cursorExpression = cursor
    ? "or(created_at.lt." + cursor.created_at + ",and(created_at.eq." + cursor.created_at + ",id.lt." + cursor.id + "))"
    : "";
  if (search && cursorExpression) {
    const pattern = "%" + search + "%";
    return SEARCH_COLUMNS.map((column) => "and(" + column + ".ilike." + pattern + "," + cursorExpression + ")").join(",");
  }
  if (search) {
    const pattern = "%" + search + "%";
    return SEARCH_COLUMNS.map((column) => column + ".ilike." + pattern).join(",");
  }
  return cursorExpression ? cursorExpression.slice(3, -1) : null;
}

/** @param {unknown} value @returns {number | null} */
export function parseDirectoryPaginationLimit(value) {
  const limit = Number(value || "100");
  return Number.isInteger(limit) && limit >= 1 && limit <= 100 ? limit : null;
}

/** @param {unknown} value @returns {{ created_at: string, id: string } | null} */
export function decodeDirectoryPaginationCursor(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.length > 1200) throw new Error("invalid cursor");
  try {
    const normalized = raw.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - raw.length % 4) % 4);
    const decoded = JSON.parse(atob(normalized));
    if (!decoded || typeof decoded.created_at !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(decoded.created_at) ||
      Number.isNaN(Date.parse(decoded.created_at)) ||
      typeof decoded.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(decoded.id)) {
      throw new Error("invalid cursor");
    }
    // Preserve the original database timestamp precision; Date#toISOString truncates PostgreSQL microseconds.
    return { created_at: decoded.created_at, id: decoded.id };
  } catch {
    throw new Error("invalid cursor");
  }
}

/** @param {{ created_at: string, id: string }} cursor @returns {string} */
export function encodeDirectoryPaginationCursor(cursor) {
  return btoa(JSON.stringify({ created_at: cursor.created_at, id: cursor.id }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

const LEGACY_DIRECTORY_CATEGORY_MAP = Object.freeze({
  cat_medical_health_clinics: "cat_medical_health_medical_practices",
  cat_medical_health_doctor: "cat_medical_health_medical_practices",
  cat_medical_health_dentist: "cat_medical_health_medical_practices",
  cat_medical_health_dental_centers: "cat_medical_health_medical_practices",
  cat_medical_health_pharmacies: "cat_medical_health_pharmacies",
  cat_medical_health_labs: "cat_medical_health_diagnostic_labs",
  cat_medical_health_radiology_specialist: "cat_medical_health_diagnostic_labs",
  cat_medical_health_hospitals: "cat_medical_health_hospitals",
  cat_medical_health_medical_centers: "cat_medical_health_hospitals",
  cat_medical_health_physio_centers: "cat_medical_health_rehabilitation",
  cat_medical_health_physiotherapist: "cat_medical_health_rehabilitation",
  cat_food_grocery_restaurants: "cat_food_grocery_restaurants",
  cat_food_grocery_cafes: "cat_food_grocery_cafes",
  cat_food_grocery_bakeries: "cat_food_grocery_bakeries_sweets",
  cat_food_grocery_sweets: "cat_food_grocery_bakeries_sweets",
  cat_food_grocery_food_suppliers: "cat_food_grocery_food_retail",
  cat_food_grocery_fresh_food: "cat_food_grocery_food_retail",
  cat_food_grocery_specialty_food: "cat_food_grocery_food_retail",
  cat_food_grocery_supermarkets: "cat_food_grocery_food_retail",
  cat_tourism_events_travel_agencies: "cat_food_grocery_hospitality_events",
  cat_tourism_events_event_halls: "cat_food_grocery_hospitality_events",
  cat_fashion_beauty_clothing_stores: "cat_fashion_beauty_clothing_stores",
  cat_fashion_beauty_beauty_products: "cat_fashion_beauty_beauty_products",
  cat_fashion_beauty_beauty_centers: "cat_fashion_beauty_salons",
  cat_fashion_beauty_salons: "cat_fashion_beauty_salons",
  cat_fashion_beauty_shoes_bags: "cat_fashion_beauty_shoes_bags",
  cat_fashion_beauty_jewelry_stores: "cat_fashion_beauty_general_retail",
  cat_trade_ecommerce_stationery_books: "cat_fashion_beauty_general_retail",
  cat_home_maintenance_furniture: "cat_home_maintenance_furniture",
  cat_home_maintenance_home_appliances: "cat_home_maintenance_furniture",
  cat_home_maintenance_home_textiles: "cat_home_maintenance_furniture",
  cat_home_maintenance_homewares: "cat_home_maintenance_furniture",
  cat_home_maintenance_pest_control: "cat_home_maintenance_home_services",
  cat_construction_decor_building_materials: "cat_home_maintenance_building_supplies",
  cat_construction_decor_interior_design: "cat_home_maintenance_finishing_companies",
  cat_construction_decor_sanitary_ware: "cat_home_maintenance_building_supplies",
  cat_industry_workshops_plastic_factories: "cat_agriculture_animals_factories",
  cat_construction_decor_aluminum_glass: "cat_home_maintenance_building_supplies",
  cat_construction_decor_contractors: "cat_home_maintenance_contractors",
  cat_construction_decor_finishing_companies: "cat_home_maintenance_finishing_companies",
  cat_auto_transport_auto_maintenance: "cat_auto_transport_auto_maintenance",
  cat_auto_transport_auto_parts: "cat_auto_transport_auto_parts",
  cat_real_estate_real_estate_agent: "cat_real_estate_residential_property",
  cat_education_training_schools: "cat_education_training_schools",
  cat_education_training_nurseries: "cat_education_training_nurseries",
  cat_education_training_tutoring_centers: "cat_education_training_tutoring",
  cat_education_training_vocational_training: "cat_education_training_training_centers",
  cat_sports_fitness_gyms: "cat_education_training_sports_centers",
  cat_sports_fitness_sports_fields: "cat_education_training_sports_centers",
  cat_technology_communications_computer_repair: "cat_technology_communications_it_networks",
  cat_technology_communications_telecom_retail: "cat_technology_communications_it_networks",
  cat_marketing_media_ad_services: "cat_technology_communications_digital_marketing",
  cat_marketing_media_marketing_agencies: "cat_technology_communications_digital_marketing",
  cat_marketing_media_photo_video: "cat_technology_communications_digital_marketing",
  cat_professional_services_law_offices: "cat_professional_services_legal_services",
  cat_professional_services_accounting_offices: "cat_professional_services_accounting_services",
  cat_finance_insurance_banks: "cat_professional_services_financial_services",
  cat_finance_insurance_insurance_companies: "cat_professional_services_financial_services",
  cat_public_community_government_services: "cat_professional_services_office_services",
  cat_public_community_office_services: "cat_professional_services_office_services",
  cat_public_community_social_organizations: "cat_professional_services_office_services",
  cat_agriculture_animals_agri_supplies: "cat_agriculture_animals_farms_agriculture",
  cat_agriculture_animals_animal_feed: "cat_agriculture_animals_animal_production",
  cat_agriculture_animals_veterinary_clinics: "cat_agriculture_animals_veterinary",
  cat_industry_workshops_food_factories: "cat_agriculture_animals_factories",
  cat_industry_workshops_garment_factories: "cat_agriculture_animals_factories",
  cat_industry_workshops_metal_workshops: "cat_agriculture_animals_workshops",
});
const LEGACY_GROUP_MAP = Object.freeze({
  dining: "food_grocery",
  food_grocery: "food_grocery",
  retail: "fashion_beauty",
  trade_ecommerce: "fashion_beauty",
  services: "professional_services",
  public_community: "professional_services",
  healthcare: "medical_health",
  medical_health: "medical_health",
  crafts_maintenance: "home_maintenance",
  construction_decor: "home_maintenance",
  home_maintenance: "home_maintenance",
  marketing_media: "technology_communications",
  sports_fitness: "education_training",
  education_training: "education_training",
  tourism_events: "food_grocery",
  finance_insurance: "professional_services",
  industry_workshops: "agriculture_animals",
  agriculture_animals: "agriculture_animals",
  auto_transport: "auto_transport",
  real_estate: "real_estate",
  technology_communications: "technology_communications",
  professional_services: "professional_services",
  fashion_beauty: "fashion_beauty",
});

/** @param {string} canonicalId @returns {string[]} */
export function expandDirectoryFunctionalGroupIds(canonicalId) {
  const aliases = Object.entries(LEGACY_GROUP_MAP)
    .filter(([, target]) => target === canonicalId)
    .map(([legacy]) => legacy);
  return Array.from(new Set([canonicalId, ...aliases]));
}

/** @param {string} canonicalId @returns {string[]} */
export function expandDirectoryTaxonomyCategoryIds(canonicalId) {
  const aliases = Object.entries(LEGACY_DIRECTORY_CATEGORY_MAP)
    .filter(([, target]) => target === canonicalId)
    .map(([legacy]) => legacy);
  return Array.from(new Set([canonicalId, ...aliases]));
}
