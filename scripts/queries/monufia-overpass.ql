[out:json][timeout:180];
rel(3824207)->.monufia_boundary;
.monufia_boundary map_to_area -> .monufia_area;
(
  .monufia_boundary;
  nwr(area.monufia_area)["shop"];
  nwr(area.monufia_area)["office"];
  nwr(area.monufia_area)["craft"];
  nwr(area.monufia_area)["healthcare"];
  nwr(area.monufia_area)["amenity"~"hospital|pharmacy|doctors|clinic|dentist|laboratory|physiotherapist|restaurant|fast_food|food_court|cafe|juice_bar|school|college|university|kindergarten|childcare|language_school|music_school|bank|bureau_de_change|car_repair|veterinary"];
  nwr(area.monufia_area)["tourism"~"hotel|guest_house|hostel|motel"];
  nwr(area.monufia_area)["leisure"~"fitness_centre|sports_centre"];
);
out center tags;
