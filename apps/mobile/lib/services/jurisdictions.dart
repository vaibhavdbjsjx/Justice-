import 'dart:convert';
import 'package:flutter/services.dart';

class Subdivision {
  Subdivision(this.code, this.name);
  final String code;
  final String name;
}

class Country {
  Country(this.code, this.name, this.subdivisionLabel, this.subdivisions);
  final String code;
  final String name;
  final String subdivisionLabel;
  final List<Subdivision> subdivisions;
}

class Language {
  Language(this.code, this.name, this.nativeName);
  final String code;
  final String name;
  final String nativeName;
}

/// Countries, languages, and practice areas, generated from the web app's data.
class ReferenceData {
  ReferenceData._(this.countries, this.languages, this.practiceAreas);

  final List<Country> countries;
  final List<Language> languages;
  final List<String> practiceAreas;

  static ReferenceData? _cached;

  static Future<ReferenceData> load() async {
    final cached = _cached;
    if (cached != null) return cached;
    final raw = jsonDecode(await rootBundle.loadString('assets/data/jurisdictions.json'))
        as Map<String, dynamic>;
    final data = ReferenceData._(
      (raw['countries'] as List).cast<Map<String, dynamic>>().map((c) {
        return Country(
          c['code'] as String,
          c['name'] as String,
          (c['subdivisionLabel'] as String?) ?? 'State or region',
          (c['subdivisions'] as List? ?? const [])
              .cast<Map<String, dynamic>>()
              .map((s) => Subdivision(s['code'] as String, s['name'] as String))
              .toList(),
        );
      }).toList(),
      (raw['languages'] as List)
          .cast<Map<String, dynamic>>()
          .map((l) => Language(l['code'] as String, l['name'] as String, l['nativeName'] as String))
          .toList(),
      (raw['practiceAreas'] as List).cast<String>(),
    );
    return _cached = data;
  }

  Country? countryNamed(String? name) {
    if (name == null) return null;
    for (final country in countries) {
      if (country.name == name) return country;
    }
    return null;
  }

  String languageName(String code) {
    for (final language in languages) {
      if (language.code == code) return language.name;
    }
    return 'English';
  }
}
