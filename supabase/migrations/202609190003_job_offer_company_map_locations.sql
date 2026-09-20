-- Source listings provide city/district level location, not exact business addresses.
update public.entreprises set latitude = 31.6344, longitude = -8.0091
where lower(nom) = lower('Orchid island real estate sarl')
  and (latitude is null or longitude is null);

update public.entreprises set latitude = 31.6491, longitude = -8.0172
where lower(nom) = lower('MARRAKECH TOP AGRO EXPORT')
  and (latitude is null or longitude is null);

update public.entreprises set latitude = 31.6310, longitude = -8.0140
where lower(nom) = lower('Mor Thai Spa Marrakech')
  and (latitude is null or longitude is null);
