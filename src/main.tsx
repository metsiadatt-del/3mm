import React from 'react';
import ReactDOM from 'react-dom/client';
import 'vazirmatn/Vazirmatn-font-face.css';
import './styles.css';
class StartupBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.error('MetaFinance render failed', error); }
  render() {
    return this.state.failed ? <section role="alert" style={{ padding: '32px' }}><h1>اجرای برنامه با خطا مواجه شد</h1><p>اطلاعات مالی شما حذف نشده است. صفحه را دوباره بارگذاری کنید.</p><button onClick={() => window.location.reload()}>تلاش دوباره</button></section> : this.props.children;
  }
}
const root = document.getElementById('root')!;
void import('./App').then(({ default: App }) => {
  ReactDOM.createRoot(root).render(<React.StrictMode><StartupBoundary><App /></StartupBoundary></React.StrictMode>);
}).catch(error => {
  console.error('MetaFinance startup failed', error);
  root.textContent = 'فایل‌های برنامه بارگذاری نشدند. اتصال اینترنت و انتشار کامل فایل‌های خروجی را بررسی و صفحه را دوباره بارگذاری کنید.';
});
if ('serviceWorker' in navigator && import.meta.env.PROD) window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}));
