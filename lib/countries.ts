// ISO 3166-1 country reference for the country combobox and code/flag
// conversions. Kept as one compact source; lib/country-display derives its
// lookup maps from here so the UI list and the scoreboard rendering can never
// disagree. Covers all countries common in racket sports plus the rest of the
// world's major ones (~150).

export interface CountryEntry {
  iso2: string
  iso3: string
  ru: string
}

const RAW = `
AD|AND|Андорра; AE|ARE|ОАЭ; AF|AFG|Афганистан; AG|ATG|Антигуа и Барбуда; AL|ALB|Албания;
AM|ARM|Армения; AO|AGO|Ангола; AR|ARG|Аргентина; AT|AUT|Австрия; AU|AUS|Австралия;
AZ|AZE|Азербайджан; BA|BIH|Босния и Герцеговина; BB|BRB|Барбадос; BD|BGD|Бангладеш;
BE|BEL|Бельгия; BF|BFA|Буркина-Фасо; BG|BGR|Болгария; BH|BHR|Бахрейн; BI|BDI|Бурунди;
BJ|BEN|Бенин; BM|BMU|Бермуды; BN|BRN|Бруней; BO|BOL|Боливия; BR|BRA|Бразилия;
BS|BHS|Багамы; BT|BTN|Бутан; BW|BWA|Ботсвана; BY|BLR|Беларусь; BZ|BLZ|Белиз;
CA|CAN|Канада; CD|COD|ДР Конго; CF|CAF|ЦАР; CG|COG|Конго; CH|CHE|Швейцария;
CI|CIV|Кот-д’Ивуар; CL|CHL|Чили; CM|CMR|Камерун; CN|CHN|Китай; CO|COL|Колумбия;
CR|CRI|Коста-Рика; CU|CUB|Куба; CV|CPV|Кабо-Верде; CY|CYP|Кипр; CZ|CZE|Чехия;
DE|DEU|Германия; DJ|DJI|Джибути; DK|DNK|Дания; DM|DMA|Доминика; DO|DOM|Доминиканская Республика;
DZ|DZA|Алжир; EC|ECU|Эквадор; EE|EST|Эстония; EG|EGY|Египет; ER|ERI|Эритрея;
ES|ESP|Испания; ET|ETH|Эфиопия; FI|FIN|Финляндия; FJ|FJI|Фиджи; FM|FSM|Микронезия;
FO|FRO|Фарерские острова; FR|FRA|Франция; GA|GAB|Габон; GB|GBR|Великобритания;
GD|GRD|Гренада; GE|GEO|Грузия; GH|GHA|Гана; GM|GMB|Гамбия; GN|GIN|Гвинея;
GQ|GNQ|Экваториальная Гвинея; GR|GRC|Греция; GT|GTM|Гватемала; GW|GNB|Гвинея-Бисау;
GY|GUY|Гайана; HK|HKG|Гонконг; HN|HND|Гондурас; HR|HRV|Хорватия; HT|HTI|Гаити;
HU|HUN|Венгрия; ID|IDN|Индонезия; IE|IRL|Ирландия; IL|ISR|Израиль; IN|IND|Индия;
IQ|IRQ|Ирак; IR|IRN|Иран; IS|ISL|Исландия; IT|ITA|Италия; JM|JAM|Ямайка;
JO|JOR|Иордания; JP|JPN|Япония; KE|KEN|Кения; KG|KGZ|Кыргызстан; KH|KHM|Камбоджа;
KI|KIR|Кирибати; KM|COM|Коморы; KN|KNA|Сент-Китс и Невис; KR|KOR|Южная Корея;
KW|KWT|Кувейт; KZ|KAZ|Казахстан; LA|LAO|Лаос; LB|LBN|Ливан; LC|LCA|Сент-Люсия;
LI|LIE|Лихтенштейн; LK|LKA|Шри-Ланка; LR|LBR|Либерия; LS|LSO|Лесото; LT|LTU|Литва;
LU|LUX|Люксембург; LV|LVA|Латвия; LY|LBY|Либия; MA|MAR|Марокко; MC|MCO|Монако;
MD|MDA|Молдова; ME|MNE|Черногория; MG|MDG|Мадагаскар; MK|MKD|Северная Македония;
ML|MLI|Мали; MM|MMR|Мьянма; MN|MNG|Монголия; MO|MAC|Макао; MR|MRT|Мавритания;
MT|MLT|Мальта; MU|MUS|Маврикий; MV|MDV|Мальдивы; MW|MWI|Малави; MX|MEX|Мексика;
MY|MYS|Малайзия; MZ|MOZ|Мозамбик; NA|NAM|Намибия; NC|NCL|Новая Каледония;
NE|NER|Нигер; NG|NGA|Нигерия; NI|NIC|Никарагуа; NL|NLD|Нидерланды; NO|NOR|Норвегия;
NP|NPL|Непал; NZ|NZL|Новая Зеландия; OM|OMN|Оман; PA|PAN|Панама; PE|PER|Перу;
PG|PNG|Папуа — Новая Гвинея; PH|PHL|Филиппины; PK|PAK|Пакистан; PL|POL|Польша;
PR|PRI|Пуэрто-Рико; PS|PSE|Палестина; PT|POR|Португалия; PY|PRY|Парагвай; QA|QAT|Катар;
RO|ROU|Румыния; RS|SRB|Сербия; RU|RUS|Россия; RW|RWA|Руанда; SA|SAU|Саудовская Арабия;
SB|SLB|Соломоновы Острова; SC|SYC|Сейшелы; SD|SDN|Судан; SE|SWE|Швеция; SG|SGP|Сингапур;
SI|SVN|Словения; SK|SVK|Словакия; SL|SLE|Сьерра-Леоне; SM|SMR|Сан-Марино;
SN|SEN|Сенегал; SO|SOM|Сомали; SR|SUR|Суринам; SS|SSD|Южный Судан; SV|SLV|Сальвадор;
SY|SYR|Сирия; SZ|SWZ|Эсватини; TD|TCD|Чад; TG|TGO|Того; TH|THA|Таиланд;
TJ|TJK|Таджикистан; TM|TKM|Туркменистан; TN|TUN|Тунис; TO|TON|Тонга; TR|TUR|Турция;
TT|TTO|Тринидад и Тобаго; TW|TWN|Тайвань; TZ|TZA|Танзания; UA|UKR|Украина;
UG|UGA|Уганда; US|USA|США; UY|URU|Уругвай; UZ|UZB|Узбекистан; VA|VAT|Ватикан;
VC|VCT|Сент-Винсент и Гренадины; VE|VEN|Венесуэла; VN|VNM|Вьетнам; VU|VUT|Вануату;
WS|WSM|Самоа; YE|YEM|Йемен; ZA|ZAF|ЮАР; ZM|ZMB|Замбия; ZW|ZWE|Зимбабве
`

export const COUNTRIES: CountryEntry[] = RAW.split(";")
  .map((chunk) => chunk.trim())
  .filter(Boolean)
  .map((chunk) => {
    const [iso2, iso3, ru] = chunk.split("|")
    return { iso2, iso3, ru }
  })

/** ISO2 → entry (undefined for unknown codes). */
export function countryByIso2(iso2: string): CountryEntry | undefined {
  const up = (iso2 ?? "").trim().toUpperCase()
  return COUNTRIES.find((c) => c.iso2 === up)
}

/** Accepts ISO2 or ISO3, returns the entry (undefined for unknown). */
export function countryByCode(code: string): CountryEntry | undefined {
  const up = (code ?? "").trim().toUpperCase()
  return COUNTRIES.find((c) => c.iso2 === up || c.iso3 === up)
}

/** 🇺🇦 for an ISO2 code ("" when unknown). */
export function iso2Flag(iso2: string): string {
  if (!/^[A-Z]{2}$/.test((iso2 ?? "").toUpperCase())) return ""
  return iso2
    .toUpperCase()
    .replace(/./g, (ch) => String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65))
}
