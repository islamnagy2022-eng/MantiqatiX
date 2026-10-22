/* MNTY Central Location Service
   Extends the canonical RC40 location contract for all web/PWA modules.
   Keep MNTYLocationAdapter and existing range semantics backward compatible.
   Provider-specific geocoding/routing is intentionally not fabricated here.
*/
(function(){
  'use strict';

  const RANGES = Object.freeze([
    {km:1,label:'1 كم 🎯'},
    {km:3,label:'3 كم 📍'},
    {km:5,label:'5 كم 🌐'},
    {km:10,label:'الكل 🗺️'}
  ]);

  const state={coords:null,radiusKm:3,status:'idle',accuracyMeters:null,source:null,updatedAt:null};
  let locationRequestId=0;

  const validateCoordinates=(latitude,longitude)=>{
    const lat=Number(latitude),lon=Number(longitude);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
    return {latitude:lat,longitude:lon};
  };

  const distanceKm=(lat1,lon1,lat2,lon2)=>{
    const a=validateCoordinates(lat1,lon1),b=validateCoordinates(lat2,lon2);
    if(!a||!b)return null;
    const R=6371;
    const dLat=(b.latitude-a.latitude)*Math.PI/180;
    const dLon=(b.longitude-a.longitude)*Math.PI/180;
    const sinLat=Math.sin(dLat/2),sinLon=Math.sin(dLon/2);
    const h=Math.min(1,Math.max(0,sinLat*sinLat+Math.cos(a.latitude*Math.PI/180)*Math.cos(b.latitude*Math.PI/180)*sinLon*sinLon));
    return 2*R*Math.asin(Math.sqrt(h));
  };

  const setManualLocation=(latitude,longitude,metadata={})=>{
    const coords=validateCoordinates(latitude,longitude);
    if(!coords)return false;
    ++locationRequestId;
    state.coords=coords;
    state.accuracyMeters=null;
    state.status='manual';
    state.source='manual';
    state.updatedAt=new Date().toISOString();
    if(metadata&&typeof metadata==='object'&&!Array.isArray(metadata)){
      if(typeof metadata.label==='string')state.label=metadata.label.slice(0,240);
      else delete state.label;
    }
    return getLocationSnapshot();
  };

  const clearLocation=()=>{
    ++locationRequestId;
    state.coords=null;
    state.accuracyMeters=null;
    state.status='idle';
    state.source=null;
    state.updatedAt=null;
    delete state.label;
    return getLocationSnapshot();
  };

  const getLocationSnapshot=()=>({
    coords:state.coords?{latitude:state.coords.latitude,longitude:state.coords.longitude}:null,
    radiusKm:state.radiusKm,
    status:state.status,
    accuracyMeters:state.accuracyMeters,
    source:state.source,
    updatedAt:state.updatedAt,
    label:state.label||null
  });

  // GeoJSON Polygon or a ring of [longitude, latitude] pairs.
  // Returns null for malformed geometry rather than guessing coverage.
  const pointInZone=(latitude,longitude,zone)=>{
    const point=validateCoordinates(latitude,longitude);
    if(!point||!zone)return null;
    let ring=Array.isArray(zone)?zone:(zone.type==='Polygon'&&Array.isArray(zone.coordinates)?zone.coordinates[0]:null);
    if(!Array.isArray(ring)||ring.length<4)return null;
    const points=[];
    for(const pair of ring){
      if(!Array.isArray(pair)||pair.length<2)return null;
      const c=validateCoordinates(pair[1],pair[0]);
      if(!c)return null;
      points.push([c.longitude,c.latitude]);
    }
    let inside=false;
    const x=point.longitude,y=point.latitude;
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const [xi,yi]=points[i],[xj,yj]=points[j];
      const cross=(x-xi)*(yj-yi)-(y-yi)*(xj-xi);
      if(Math.abs(cross)<1e-10&&x>=Math.min(xi,xj)-1e-10&&x<=Math.max(xi,xj)+1e-10&&y>=Math.min(yi,yj)-1e-10&&y<=Math.max(yi,yj)+1e-10)return true;
      const intersects=((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi);
      if(intersects)inside=!inside;
    }
    return inside;
  };

  const requestLocation=()=>new Promise(resolve=>{
    const requestId=++locationRequestId;
    if(!navigator.geolocation){state.status='unsupported';resolve(null);return}
    state.status='requesting';
    navigator.geolocation.getCurrentPosition(
      p=>{
        if(requestId!==locationRequestId)return resolve(null);
        const coords=validateCoordinates(p.coords.latitude,p.coords.longitude);
        if(!coords){state.coords=null;state.accuracyMeters=null;state.source=null;state.status='unavailable';resolve(null);return}
        state.coords=coords;
        state.accuracyMeters=Number.isFinite(p.coords.accuracy)&&p.coords.accuracy>=0?p.coords.accuracy:null;
        state.status='ready';
        state.source='gps';
        state.updatedAt=new Date().toISOString();
        delete state.label;
        resolve(getLocationSnapshot().coords);
      },
      error=>{
        if(requestId!==locationRequestId)return resolve(null);
        state.coords=null;
        state.accuracyMeters=null;
        state.source=null;
        state.status=error?.code===1?'denied':error?.code===3?'timeout':'unavailable';
        state.updatedAt=null;
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
        if(allowed.has(row.business_id)){const d=Number(row.distance_km);if(Number.isFinite(d)&&d>=0)nearest[row.business_id]=d;}
      });
    }catch(_){}
    if(Object.keys(nearest).length||Number(state.radiusKm)>=10)return {nearest,fallback:{}};
    try{
      const r=await sb.rpc('find_mnty_nearest_provider_businesses',{p_lat:state.coords.latitude,p_lon:state.coords.longitude,p_limit:12});
      if(requestId!==locationRequestId)return {nearest:{},fallback:{}};
      if(!r.error){
        const fallback={};
        (r.data||[]).forEach(row=>{
          if(allowed.has(row.business_id)){const d=Number(row.distance_km);if(Number.isFinite(d)&&d>=0)fallback[row.business_id]=d;}
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
    if(state.status==='manual')return 'تم اختيار الموقع يدويًا';
    if(state.status==='requesting')return 'جارٍ تحديد موقعك…';
    if(state.status==='denied')return 'تم رفض إذن الموقع — يمكنك اختيار الموقع يدويًا';
    if(state.status==='timeout')return 'انتهت مهلة تحديد الموقع — يمكنك اختيار الموقع يدويًا';
    if(state.status==='unsupported')return 'الموقع غير مدعوم — يمكنك اختيار الموقع يدويًا';
    if(state.status==='unavailable')return 'الموقع غير متاح — يمكنك اختيار الموقع يدويًا';
    return 'الموقع عند الحاجة';
  };

  // Preserve the legacy global name for existing home/PWA consumers.
  window.MNTYLocationAdapter=Object.freeze({
    ranges:RANGES,
    state,
    requestLocation,
    applyProviderRange,
    setRadius,
    statusText,
    distanceKm,
    validateCoordinates,
    setManualLocation,
    clearLocation,
    getLocationSnapshot,
    pointInZone
  });
})();