import { useState } from 'react';
import { jalaaliMonthLength, toGregorian, toJalaali } from 'jalaali-js';
import { CalendarDays, X } from 'lucide-react';
import { fa } from './finance';
const months=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
export default function JalaliDateField({ label, name, defaultValue, value, onChange, optional=false }: { label:string;name?:string;defaultValue?:string;value?:string;onChange?:(v:string)=>void;optional?:boolean }) {
  const [internal,setInternal]=useState(defaultValue??new Date().toISOString().slice(0,10));
  const iso=value??internal;const date=iso?new Date(iso+'T12:00:00'):new Date();const j=toJalaali(date);
  function change(part:'jy'|'jm'|'jd', val:number){const next={...j,[part]:val};next.jd=Math.min(next.jd,jalaaliMonthLength(next.jy,next.jm));const g=toGregorian(next.jy,next.jm,next.jd);const output=`${g.gy}-${String(g.gm).padStart(2,'0')}-${String(g.gd).padStart(2,'0')}`;setInternal(output);onChange?.(output);}
  return <div className="field"><span>{label}</span><div className={`jalali-picker ${!iso&&optional?'date-empty':''}`} role="group" aria-label={label}><CalendarDays size={16}/><select aria-label={`${label}، روز`} value={j.jd} onChange={e=>change('jd',+e.target.value)}>{Array.from({length:jalaaliMonthLength(j.jy,j.jm)},(_,i)=><option key={i} value={i+1}>{fa(i+1)}</option>)}</select><select aria-label={`${label}، ماه`} value={j.jm} onChange={e=>change('jm',+e.target.value)}>{months.map((m,i)=><option value={i+1} key={m}>{m}</option>)}</select><select aria-label={`${label}، سال`} value={j.jy} onChange={e=>change('jy',+e.target.value)}>{Array.from({length:111},(_,i)=>toJalaali(new Date()).jy+10-i).map(y=><option value={y} key={y}>{fa(y)}</option>)}</select>{optional&&<button type="button" aria-label={`پاک کردن ${label}`} onClick={()=>{setInternal('');onChange?.('');}}><X size={13}/></button>}</div>{!iso&&optional&&<small>بدون محدودیت تاریخ؛ برای فیلتر، روز یا ماه را انتخاب کنید.</small>}{name&&<input type="hidden" name={name} value={iso}/>}</div>;
}
