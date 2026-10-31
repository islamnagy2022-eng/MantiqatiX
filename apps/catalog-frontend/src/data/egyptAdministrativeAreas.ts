// Egyptian administrative names currently seeded by the platform master migrations.
// This is a selection catalogue, not a spatial boundary dataset. GPS cannot safely infer a village
// or Markaz from these names alone; automatic administrative matching requires trusted polygons.
// Reconcile this seed against the latest CAPMAS Administrative Units Directory before future expansion.
export type EgyptGovernorate = { code: string; name: string; nameEn: string };
export type EgyptCenter = { code: string; name: string; governorateCode: string };

export const EGYPT_GOVERNORATES: EgyptGovernorate[] = [
  {
    "code": "01",
    "name": "القاهرة",
    "nameEn": "Cairo"
  },
  {
    "code": "02",
    "name": "الإسكندرية",
    "nameEn": "Alexandria"
  },
  {
    "code": "03",
    "name": "بورسعيد",
    "nameEn": "Port Said"
  },
  {
    "code": "04",
    "name": "السويس",
    "nameEn": "Suez"
  },
  {
    "code": "11",
    "name": "دمياط",
    "nameEn": "Damietta"
  },
  {
    "code": "12",
    "name": "الدقهلية",
    "nameEn": "Dakahlia"
  },
  {
    "code": "13",
    "name": "الشرقية",
    "nameEn": "Sharkia"
  },
  {
    "code": "14",
    "name": "القليوبية",
    "nameEn": "Qalyubia"
  },
  {
    "code": "15",
    "name": "كفر الشيخ",
    "nameEn": "Kafr El Sheikh"
  },
  {
    "code": "16",
    "name": "الغربية",
    "nameEn": "Gharbia"
  },
  {
    "code": "17",
    "name": "المنوفية",
    "nameEn": "Menoufia"
  },
  {
    "code": "18",
    "name": "البحيرة",
    "nameEn": "Beheira"
  },
  {
    "code": "19",
    "name": "الإسماعيلية",
    "nameEn": "Ismailia"
  },
  {
    "code": "21",
    "name": "الجيزة",
    "nameEn": "Giza"
  },
  {
    "code": "22",
    "name": "بني سويف",
    "nameEn": "Beni Suef"
  },
  {
    "code": "23",
    "name": "الفيوم",
    "nameEn": "Faiyum"
  },
  {
    "code": "24",
    "name": "المنيا",
    "nameEn": "Minya"
  },
  {
    "code": "25",
    "name": "أسيوط",
    "nameEn": "Assiut"
  },
  {
    "code": "26",
    "name": "سوهاج",
    "nameEn": "Sohag"
  },
  {
    "code": "27",
    "name": "قنا",
    "nameEn": "Qena"
  },
  {
    "code": "28",
    "name": "أسوان",
    "nameEn": "Aswan"
  },
  {
    "code": "29",
    "name": "الأقصر",
    "nameEn": "Luxor"
  },
  {
    "code": "31",
    "name": "البحر الأحمر",
    "nameEn": "Red Sea"
  },
  {
    "code": "32",
    "name": "الوادي الجديد",
    "nameEn": "New Valley"
  },
  {
    "code": "33",
    "name": "مطروح",
    "nameEn": "Matrouh"
  },
  {
    "code": "34",
    "name": "شمال سيناء",
    "nameEn": "North Sinai"
  },
  {
    "code": "35",
    "name": "جنوب سيناء",
    "nameEn": "South Sinai"
  }
];

export const EGYPT_CENTERS: EgyptCenter[] = [
  {
    "code": "EG1102",
    "name": "دمياط",
    "governorateCode": "11"
  },
  {
    "code": "EG1103",
    "name": "فارسكور",
    "governorateCode": "11"
  },
  {
    "code": "EG1104",
    "name": "كفر سعد",
    "governorateCode": "11"
  },
  {
    "code": "EG1107",
    "name": "الزرقا",
    "governorateCode": "11"
  },
  {
    "code": "EG1203",
    "name": "المنصورة",
    "governorateCode": "12"
  },
  {
    "code": "EG1204",
    "name": "أجا",
    "governorateCode": "12"
  },
  {
    "code": "EG1205",
    "name": "السنبلاوين",
    "governorateCode": "12"
  },
  {
    "code": "EG1206",
    "name": "المطرية",
    "governorateCode": "12"
  },
  {
    "code": "EG1207",
    "name": "المنزلة",
    "governorateCode": "12"
  },
  {
    "code": "EG1208",
    "name": "بلقاس",
    "governorateCode": "12"
  },
  {
    "code": "EG1209",
    "name": "دكرنس",
    "governorateCode": "12"
  },
  {
    "code": "EG1210",
    "name": "شربين",
    "governorateCode": "12"
  },
  {
    "code": "EG1211",
    "name": "طلخا",
    "governorateCode": "12"
  },
  {
    "code": "EG1213",
    "name": "ميت غمر",
    "governorateCode": "12"
  },
  {
    "code": "EG1214",
    "name": "منية النصر",
    "governorateCode": "12"
  },
  {
    "code": "EG1215",
    "name": "الجمالية",
    "governorateCode": "12"
  },
  {
    "code": "EG1216",
    "name": "تمى الأمديد",
    "governorateCode": "12"
  },
  {
    "code": "EG1217",
    "name": "ميت سلسيل",
    "governorateCode": "12"
  },
  {
    "code": "EG1218",
    "name": "بنى عبيد",
    "governorateCode": "12"
  },
  {
    "code": "EG1219",
    "name": "محلة دمنة",
    "governorateCode": "12"
  },
  {
    "code": "EG1221",
    "name": "نبروة",
    "governorateCode": "12"
  },
  {
    "code": "EG1303",
    "name": "الزقازيق",
    "governorateCode": "13"
  },
  {
    "code": "EG1304",
    "name": "أبو حماد",
    "governorateCode": "13"
  },
  {
    "code": "EG1305",
    "name": "أبوكبير",
    "governorateCode": "13"
  },
  {
    "code": "EG1306",
    "name": "الحسينية",
    "governorateCode": "13"
  },
  {
    "code": "EG1308",
    "name": "بلبيس",
    "governorateCode": "13"
  },
  {
    "code": "EG1310",
    "name": "ديرب نجم",
    "governorateCode": "13"
  },
  {
    "code": "EG1312",
    "name": "فاقوس",
    "governorateCode": "13"
  },
  {
    "code": "EG1313",
    "name": "كفر صقر",
    "governorateCode": "13"
  },
  {
    "code": "EG1314",
    "name": "منيا القمح",
    "governorateCode": "13"
  },
  {
    "code": "EG1315",
    "name": "ههيا",
    "governorateCode": "13"
  },
  {
    "code": "EG1316",
    "name": "مشتول السوق",
    "governorateCode": "13"
  },
  {
    "code": "EG1317",
    "name": "الأبراهيمية",
    "governorateCode": "13"
  },
  {
    "code": "EG1319",
    "name": "أولاد صقر",
    "governorateCode": "13"
  },
  {
    "code": "EG1402",
    "name": "بنها",
    "governorateCode": "14"
  },
  {
    "code": "EG1403",
    "name": "الخانكة",
    "governorateCode": "14"
  },
  {
    "code": "EG1404",
    "name": "القناطر الخيرية",
    "governorateCode": "14"
  },
  {
    "code": "EG1405",
    "name": "شبين القناطر",
    "governorateCode": "14"
  },
  {
    "code": "EG1408",
    "name": "طوخ",
    "governorateCode": "14"
  },
  {
    "code": "EG1410",
    "name": "قليوب",
    "governorateCode": "14"
  },
  {
    "code": "EG1411",
    "name": "كفر شكر",
    "governorateCode": "14"
  },
  {
    "code": "EG1502",
    "name": "كفر الشيخ",
    "governorateCode": "15"
  },
  {
    "code": "EG1503",
    "name": "البرلس",
    "governorateCode": "15"
  },
  {
    "code": "EG1504",
    "name": "بيلا",
    "governorateCode": "15"
  },
  {
    "code": "EG1506",
    "name": "دسوق",
    "governorateCode": "15"
  },
  {
    "code": "EG1507",
    "name": "سيدى سالم",
    "governorateCode": "15"
  },
  {
    "code": "EG1508",
    "name": "فوه",
    "governorateCode": "15"
  },
  {
    "code": "EG1509",
    "name": "قلين",
    "governorateCode": "15"
  },
  {
    "code": "EG1510",
    "name": "مطوبس",
    "governorateCode": "15"
  },
  {
    "code": "EG1511",
    "name": "الحامول",
    "governorateCode": "15"
  },
  {
    "code": "EG1512",
    "name": "الرياض",
    "governorateCode": "15"
  },
  {
    "code": "EG1603",
    "name": "طنطا",
    "governorateCode": "16"
  },
  {
    "code": "EG1604",
    "name": "السنطة",
    "governorateCode": "16"
  },
  {
    "code": "EG1607",
    "name": "المحله الكبرى",
    "governorateCode": "16"
  },
  {
    "code": "EG1608",
    "name": "بسيون",
    "governorateCode": "16"
  },
  {
    "code": "EG1609",
    "name": "زفتى",
    "governorateCode": "16"
  },
  {
    "code": "EG1610",
    "name": "سمنود",
    "governorateCode": "16"
  },
  {
    "code": "EG1611",
    "name": "قطور",
    "governorateCode": "16"
  },
  {
    "code": "EG1612",
    "name": "كفر الزيات",
    "governorateCode": "16"
  },
  {
    "code": "EG1702",
    "name": "شبين الكوم",
    "governorateCode": "17"
  },
  {
    "code": "EG1703",
    "name": "أشمون",
    "governorateCode": "17"
  },
  {
    "code": "EG1704",
    "name": "الباجور",
    "governorateCode": "17"
  },
  {
    "code": "EG1705",
    "name": "الشهداء",
    "governorateCode": "17"
  },
  {
    "code": "EG1706",
    "name": "بركة السبع",
    "governorateCode": "17"
  },
  {
    "code": "EG1707",
    "name": "تلا",
    "governorateCode": "17"
  },
  {
    "code": "EG1708",
    "name": "قويسنا",
    "governorateCode": "17"
  },
  {
    "code": "EG1709",
    "name": "منوف",
    "governorateCode": "17"
  },
  {
    "code": "EG1711",
    "name": "السادات",
    "governorateCode": "17"
  },
  {
    "code": "EG1802",
    "name": "دمنهور",
    "governorateCode": "18"
  },
  {
    "code": "EG1803",
    "name": "ابوالمطامير",
    "governorateCode": "18"
  },
  {
    "code": "EG1804",
    "name": "ابوحمص",
    "governorateCode": "18"
  },
  {
    "code": "EG1805",
    "name": "الدلنجات",
    "governorateCode": "18"
  },
  {
    "code": "EG1806",
    "name": "المحمودية",
    "governorateCode": "18"
  },
  {
    "code": "EG1807",
    "name": "إيتاى البارود",
    "governorateCode": "18"
  },
  {
    "code": "EG1808",
    "name": "حوش عيسى",
    "governorateCode": "18"
  },
  {
    "code": "EG1809",
    "name": "رشيد",
    "governorateCode": "18"
  },
  {
    "code": "EG1810",
    "name": "شبراخيت",
    "governorateCode": "18"
  },
  {
    "code": "EG1812",
    "name": "كفر الدوار",
    "governorateCode": "18"
  },
  {
    "code": "EG1813",
    "name": "كوم حمادة",
    "governorateCode": "18"
  },
  {
    "code": "EG1814",
    "name": "وادى النطرون",
    "governorateCode": "18"
  },
  {
    "code": "EG1815",
    "name": "الرحمانية",
    "governorateCode": "18"
  },
  {
    "code": "EG1816",
    "name": "إدكو",
    "governorateCode": "18"
  },
  {
    "code": "EG1818",
    "name": "بدر",
    "governorateCode": "18"
  },
  {
    "code": "EG1904",
    "name": "الاسماعيلية",
    "governorateCode": "19"
  },
  {
    "code": "EG1905",
    "name": "التل الكبير",
    "governorateCode": "19"
  },
  {
    "code": "EG1906",
    "name": "القنطرة",
    "governorateCode": "19"
  },
  {
    "code": "EG1907",
    "name": "فايد",
    "governorateCode": "19"
  },
  {
    "code": "EG2109",
    "name": "الجيزة",
    "governorateCode": "21"
  },
  {
    "code": "EG2110",
    "name": "البدرشين",
    "governorateCode": "21"
  },
  {
    "code": "EG2111",
    "name": "الصف",
    "governorateCode": "21"
  },
  {
    "code": "EG2112",
    "name": "العياط",
    "governorateCode": "21"
  },
  {
    "code": "EG2113",
    "name": "إمبابة",
    "governorateCode": "21"
  },
  {
    "code": "EG2115",
    "name": "أطفيح",
    "governorateCode": "21"
  },
  {
    "code": "EG2116",
    "name": "أوسيم",
    "governorateCode": "21"
  },
  {
    "code": "EG2120",
    "name": "كرداسة",
    "governorateCode": "21"
  },
  {
    "code": "EG2202",
    "name": "بنى سويف",
    "governorateCode": "22"
  },
  {
    "code": "EG2204",
    "name": "الفشن",
    "governorateCode": "22"
  },
  {
    "code": "EG2205",
    "name": "الواسطى",
    "governorateCode": "22"
  },
  {
    "code": "EG2206",
    "name": "أهناسيا",
    "governorateCode": "22"
  },
  {
    "code": "EG2207",
    "name": "ببا",
    "governorateCode": "22"
  },
  {
    "code": "EG2208",
    "name": "سمسطا",
    "governorateCode": "22"
  },
  {
    "code": "EG2209",
    "name": "ناصر",
    "governorateCode": "22"
  },
  {
    "code": "EG2302",
    "name": "الفيوم",
    "governorateCode": "23"
  },
  {
    "code": "EG2303",
    "name": "أبشواى",
    "governorateCode": "23"
  },
  {
    "code": "EG2304",
    "name": "أطسا",
    "governorateCode": "23"
  },
  {
    "code": "EG2305",
    "name": "سنورس",
    "governorateCode": "23"
  },
  {
    "code": "EG2306",
    "name": "طامية",
    "governorateCode": "23"
  },
  {
    "code": "EG2307",
    "name": "يوسف الصديق",
    "governorateCode": "23"
  },
  {
    "code": "EG2402",
    "name": "المنيا",
    "governorateCode": "24"
  },
  {
    "code": "EG2404",
    "name": "ابو قرقاص",
    "governorateCode": "24"
  },
  {
    "code": "EG2405",
    "name": "العدوة",
    "governorateCode": "24"
  },
  {
    "code": "EG2406",
    "name": "بنى مزار",
    "governorateCode": "24"
  },
  {
    "code": "EG2407",
    "name": "دير مواس",
    "governorateCode": "24"
  },
  {
    "code": "EG2408",
    "name": "سمالوط",
    "governorateCode": "24"
  },
  {
    "code": "EG2409",
    "name": "مطاى",
    "governorateCode": "24"
  },
  {
    "code": "EG2410",
    "name": "مغاغة",
    "governorateCode": "24"
  },
  {
    "code": "EG2412",
    "name": "ملوى",
    "governorateCode": "24"
  },
  {
    "code": "EG2503",
    "name": "أسيوط",
    "governorateCode": "25"
  },
  {
    "code": "EG2504",
    "name": "أبنوب",
    "governorateCode": "25"
  },
  {
    "code": "EG2505",
    "name": "أبوتيج",
    "governorateCode": "25"
  },
  {
    "code": "EG2506",
    "name": "البدارى",
    "governorateCode": "25"
  },
  {
    "code": "EG2507",
    "name": "ساحل سليم",
    "governorateCode": "25"
  },
  {
    "code": "EG2508",
    "name": "الغنايم",
    "governorateCode": "25"
  },
  {
    "code": "EG2509",
    "name": "القوصية",
    "governorateCode": "25"
  },
  {
    "code": "EG2510",
    "name": "ديروط",
    "governorateCode": "25"
  },
  {
    "code": "EG2511",
    "name": "صدفا",
    "governorateCode": "25"
  },
  {
    "code": "EG2512",
    "name": "منفلوط",
    "governorateCode": "25"
  },
  {
    "code": "EG2513",
    "name": "الفتح",
    "governorateCode": "25"
  },
  {
    "code": "EG2603",
    "name": "سوهاج",
    "governorateCode": "26"
  },
  {
    "code": "EG2604",
    "name": "أخميم",
    "governorateCode": "26"
  },
  {
    "code": "EG2605",
    "name": "البلينا",
    "governorateCode": "26"
  },
  {
    "code": "EG2606",
    "name": "المراغة",
    "governorateCode": "26"
  },
  {
    "code": "EG2607",
    "name": "المنشأة",
    "governorateCode": "26"
  },
  {
    "code": "EG2608",
    "name": "دار السلام",
    "governorateCode": "26"
  },
  {
    "code": "EG2610",
    "name": "جرجا",
    "governorateCode": "26"
  },
  {
    "code": "EG2611",
    "name": "جهينة الغربية",
    "governorateCode": "26"
  },
  {
    "code": "EG2612",
    "name": "ساقلته",
    "governorateCode": "26"
  },
  {
    "code": "EG2613",
    "name": "طما",
    "governorateCode": "26"
  },
  {
    "code": "EG2614",
    "name": "طهطا",
    "governorateCode": "26"
  },
  {
    "code": "EG2617",
    "name": "العسيرات",
    "governorateCode": "26"
  },
  {
    "code": "EG2702",
    "name": "قنا",
    "governorateCode": "27"
  },
  {
    "code": "EG2703",
    "name": "أبو طشت",
    "governorateCode": "27"
  },
  {
    "code": "EG2704",
    "name": "أرمنت",
    "governorateCode": "27"
  },
  {
    "code": "EG2705",
    "name": "إسنا",
    "governorateCode": "27"
  },
  {
    "code": "EG2706",
    "name": "دشنا",
    "governorateCode": "27"
  },
  {
    "code": "EG2707",
    "name": "قوص",
    "governorateCode": "27"
  },
  {
    "code": "EG2708",
    "name": "نجع حمادى",
    "governorateCode": "27"
  },
  {
    "code": "EG2709",
    "name": "نقادة",
    "governorateCode": "27"
  },
  {
    "code": "EG2710",
    "name": "فرشوط",
    "governorateCode": "27"
  },
  {
    "code": "EG2711",
    "name": "قفط",
    "governorateCode": "27"
  },
  {
    "code": "EG2712",
    "name": "الوقف",
    "governorateCode": "27"
  },
  {
    "code": "EG2802",
    "name": "أسوان",
    "governorateCode": "28"
  },
  {
    "code": "EG2803",
    "name": "أدفو",
    "governorateCode": "28"
  },
  {
    "code": "EG2804",
    "name": "كوم امبو",
    "governorateCode": "28"
  },
  {
    "code": "EG2805",
    "name": "نصر",
    "governorateCode": "28"
  },
  {
    "code": "EG2806",
    "name": "دراو",
    "governorateCode": "28"
  },
  {
    "code": "EG2807",
    "name": "أبوسنبل",
    "governorateCode": "28"
  },
  {
    "code": "EG2902",
    "name": "الأقصر",
    "governorateCode": "29"
  },
  {
    "code": "EG2903",
    "name": "شرطة طيبة",
    "governorateCode": "29"
  },
  {
    "code": "EG3201",
    "name": "الواحات الخارجة",
    "governorateCode": "32"
  },
  {
    "code": "EG3202",
    "name": "الوحات الداخلة",
    "governorateCode": "32"
  },
  {
    "code": "EG3203",
    "name": "الفرافرة",
    "governorateCode": "32"
  },
  {
    "code": "EG3204",
    "name": "باريس",
    "governorateCode": "32"
  },
  {
    "code": "EG3304",
    "name": "الضبعة",
    "governorateCode": "33"
  },
  {
    "code": "EG3306",
    "name": "سيوة",
    "governorateCode": "33"
  }
];

export const EGYPT_GEO_DATA_SOURCE = 'MantiqatiX platform_geo_areas seed migrations (RC210 + provider location markaz baseline)';
