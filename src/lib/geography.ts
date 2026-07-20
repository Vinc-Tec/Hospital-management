import { useEffect, useState } from 'react';
import { supabase, type Country, type Region, type District, type City, type Locality } from './supabase';

export function useGeography() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('countries').select('*').order('name');
      setCountries((data as Country[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const loadRegions = async (countryId: string | null) => {
    setRegions([]); setDistricts([]); setCities([]); setLocalities([]);
    if (!countryId) return;
    const { data } = await supabase.from('regions').select('*').eq('country_id', countryId).order('name');
    setRegions((data as Region[]) ?? []);
  };
  const loadDistricts = async (regionId: string | null) => {
    setDistricts([]); setCities([]); setLocalities([]);
    if (!regionId) return;
    const { data } = await supabase.from('districts').select('*').eq('region_id', regionId).order('name');
    setDistricts((data as District[]) ?? []);
  };
  const loadCities = async (districtId: string | null) => {
    setCities([]); setLocalities([]);
    if (!districtId) return;
    const { data } = await supabase.from('cities').select('*').eq('district_id', districtId).order('name');
    setCities((data as City[]) ?? []);
  };
  const loadLocalities = async (cityId: string | null) => {
    setLocalities([]);
    if (!cityId) return;
    const { data } = await supabase.from('localities').select('*').eq('city_id', cityId).order('name');
    setLocalities((data as Locality[]) ?? []);
  };

  return { countries, regions, districts, cities, localities, loading, loadRegions, loadDistricts, loadCities, loadLocalities };
}
