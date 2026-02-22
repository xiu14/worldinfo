import { useState, Component, ErrorInfo, ReactNode } from 'react';
import { Popup } from 'sillytavern-utils-lib/components/react';
import { POPUP_TYPE } from 'sillytavern-utils-lib/types/popup';
import { MainPopup } from './MainPopup.js';

/**
 * Error Boundary to catch React rendering errors inside MainPopup.
 * Prevents the entire Popup from being unmounted on error,
 * which would make the popup permanently unopenable.
 */
class PopupErrorBoundary extends Component<
  { children: ReactNode; onReset: () => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; onReset: () => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[WorldInfoRecommender] React render error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h3 style={{ color: 'var(--red, #e74c3c)', marginBottom: '10px' }}>⚠️ 插件渲染出错</h3>
          <p style={{ color: 'var(--SmartThemeBodyColor, #ccc)', marginBottom: '5px', fontSize: '0.9em' }}>
            {this.state.error?.message || '未知错误'}
          </p>
          <p style={{ color: 'var(--SmartThemeBodyColor, #888)', marginBottom: '15px', fontSize: '0.8em' }}>
            错误信息已记录到控制台 (F12)
          </p>
          <button
            className="menu_button interactable"
            onClick={() => {
              this.setState({ hasError: false, error: null });
            }}
            style={{ marginRight: '10px' }}
          >
            🔄 重试
          </button>
          <button
            className="menu_button interactable"
            onClick={() => {
              this.props.onReset();
            }}
          >
            ❌ 关闭
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export const PopupManager = () => {
  const [isPopupVisible, setIsPopupVisible] = useState(false);

  // This function will be exposed to the global scope to be called by vanilla JS
  const openPopup = () => setIsPopupVisible(true);
  const closePopup = () => setIsPopupVisible(false);

  // Expose the open function to the outside world
  // @ts-ignore
  window.openWorldInfoRecommenderPopup = openPopup;

  if (!isPopupVisible) {
    return null; // Don't render anything if the popup is closed
  }

  return (
    <Popup
      content={
        <PopupErrorBoundary onReset={closePopup}>
          <MainPopup />
        </PopupErrorBoundary>
      }
      type={POPUP_TYPE.DISPLAY}
      onComplete={closePopup} // The popup component now controls closing
      options={{
        large: true,
        wide: true,
      }}
    />
  );
};
