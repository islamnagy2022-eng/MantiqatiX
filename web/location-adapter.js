/* MNTY Location Adapter
   Web/PWA integration layer for the canonical RC40 location contract.
   It does not replace LocationEngine; it adapts browser location permission
   to the existing GPS/range semantics used by the Android client.
*/
(function(){
  'use strict';

  const RANGES = Object.freeze([
    {km:1,label:'1 كم 🎯'},
    {km:3,label:'3 كم 📍'},
    {km:5,label:'5 كم 🌐'},
    {km:10,label:'الكل 🗺️'}
  ]);

  const state={coords:null,radiusKm:3,status:'idle',accuracyMeters:null};
  let locationRequestId=0;

  const distanceKm=(lat1,lon1,lat2,lon2)=>{
    const R=6371;
    const dLat=(lat2-lat1)*Math.PI/180;
    const dLon=(lon2-lon1)*Math.PI/180;
    const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(a));
  };

  const requestLocation=()=>new Promise(resolve=>{
    const requestId=++locationRequestId;
    if(!navigator.geolocation){state.status='unsupported';resolve(null);return}
    state.status='requesting';
    navigator.geolocation.getCurrentPosition(
      p=>{
        if(requestId!==locationRequestId)return resolve(null);
        const latitude=Number(p.coords.latitude),longitude=Number(p.coords.longitude);
        if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180){state.coords=null;state.status='denied';return resolve(null)}
        state.coords={latitude,longitude};
        state.accuracyMeters=Number.isFinite(p.coords.accuracy)?p.coords.accuracy:null;
        state.status='ready';
        resolve(state.coords);
      },
      ()=>{
        if(requestId!==locationRequestId)return resolve(null);
        state.coords=null;
        state.status='denied';
        resolve(null);
      },
      {enableHighAccuracy:false,maximumAge:300000,timeout:7000}
    );
  });

  const loadBranchDistances=async(sb,businessIds)=>{
    if(!sb||!state.coords||!businessIds.length)return {nearest:{},fallback:{}};
    const requestId=locationRequestId;
    const ids=[...new Set(businessIds.filter(Boolean))];
    if(!ids.length)return {nearest:{},fallback:{}};
    const allowed=new Set(ids);
    const nearest={};
    try{
      const r=await sb.rpc('find_mnty_nearby_provider_businesses',{p_lat:state.coords.latitude,p_lon:state.coords.longitude,p_radius_km:state.radiusKm});
      if(requestId!==locationRequestId)return {nearest:{},fallback:{}};
      if(!r.error)(r.data||[]).forEach(row=>{
        if(allowed.has(row.business_id))nearest[row.business_id]=Number(row.distance_km);
      });
    }catch(_){}
    if(Object.keys(nearest).length||Number(state.radiusKm)>=10)return {nearest,fallback:{}};
    try{
      const r=await sb.rpc('find_mnty_nearest_provider_businesses',{p_lat:state.coords.latitude,p_lon:state.coords.longitude,p_limit:12});
      if(requestId!==locationRequestId)return {nearest:{},fallback:{}};
      if(!r.error){
        const fallback={};
        (r.data||[]).forEach(row=>{
          if(allowed.has(row.business_id))fallback[row.business_id]=Number(row.distance_km);
        });
        return {nearest,fallback};
      }
    }catch(_){}
    return {nearest,fallback:{}};
  };

  const applyProviderRange=async(sb,providers)=>{
    const list=Array.isArray(providers)?providers:[];
    if(!state.coords)return list.map(p=>({...p,_distanceKm:null,_nearestFallback:false}));
    const distances=await loadBranchDistances(sb,list.map(p=>p.business_id));
    const maxKm=Number(state.radiusKm);
    const local=list
      .map(p=>({...p,_distanceKm:distances.nearest[p.business_id]??null,_nearestFallback:false}))
      .filter(p=>maxKm>=10||p._distanceKm!=null&&p._distanceKm<=maxKm)
      .sort((a,b)=>{
        if(a._distanceKm==null&&b._distanceKm==null)return 0;
        if(a._distanceKm==null)return 1;
        if(b._distanceKm==null)return -1;
        return a._distanceKm-b._distanceKm;
      });
    if(local.length||maxKm>=10)return local;
    return list
      .map(p=>({...p,_distanceKm:distances.fallback[p.business_id]??null,_nearestFallback:distances.fallback[p.business_id]!=null}))
      .filter(p=>p._distanceKm!=null)
      .sort((a,b)=>a._distanceKm-b._distanceKm);
  };

  const setRadius=km=>{
    const n=Number(km);
    if(RANGES.some(x=>x.km===n))state.radiusKm=n;
    return state.radiusKm;
  };

  const statusText=()=>{
    if(state.status==='ready')return 'تم تحديد موقعك';
    if(state.status==='requesting')return 'جارٍ تحديد موقعك…';
    if(state.status==='denied')return 'الموقع غير متاح — عرض النتائج العامة';
    if(state.status==='unsupported')return 'الموقع غير مدعوم — عرض النتائج العامة';
    return 'الموقع عند الحاجة';
  };

  window.MNTYLocationAdapter=Object.freeze({
    ranges:RANGES,
    state,
    requestLocation,
    applyProviderRange,
    setRadius,
    statusText,
    distanceKm
  });
})();