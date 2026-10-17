'use client';
import { App, ConfigProvider, type ThemeConfig } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
dayjs.locale('zh-cn');

const theme: ThemeConfig = {
  token: {
    colorPrimary: '#168878', colorInfo: '#168878',
    colorPrimaryBg: '#edf7f3', colorPrimaryBgHover: '#e3f1eb',
    colorPrimaryBorder: '#bddacf', colorPrimaryBorderHover: '#9fc5b8',
    colorPrimaryHover: '#218675', colorPrimaryActive: '#127565',
    colorPrimaryText: '#168878', colorPrimaryTextHover: '#218675', colorPrimaryTextActive: '#127565',
    colorInfoBg: '#edf7f3', colorInfoBgHover: '#e3f1eb', colorInfoBorder: '#cfe4da',
    colorSuccess: '#32866e', colorSuccessBg: '#edf7f3', colorSuccessBgHover: '#e3f1eb',
    colorSuccessBorder: '#cfe4da', colorSuccessText: '#287c65',
    colorLink: '#168878', colorLinkHover: '#218675', colorLinkActive: '#127565',
    controlItemBgHover: '#f3f8f5', controlItemBgActive: '#edf7f3', controlItemBgActiveHover: '#e3f1eb',
    controlItemBgActiveDisabled: '#eef3f0', colorBgTextHover: '#f3f8f5', colorBgTextActive: '#e3f1eb',
    colorBgContainerDisabled: '#f5f7f6', colorBorderDisabled: '#e1e7e4', colorTextDisabled: '#91a099',
    borderRadius: 9, colorText: '#233333', colorTextSecondary: '#6b7e72', colorBorder: '#e3e9e8',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: 15, lineHeight: 1.65, controlHeight: 42,
  },
  components: {
    Rate: { starColor: '#168878', starBg: '#e6eeea' },
    Select: { activeOutlineColor: 'transparent', controlOutlineWidth: 0, lineWidthFocus: 0, optionSelectedBg: '#edf7f3', optionSelectedColor: '#168878', optionActiveBg: '#f3f8f5' },
    Input: { activeShadow: 'none', errorActiveShadow: 'none', warningActiveShadow: 'none', lineWidthFocus: 0 },
    InputNumber: { activeShadow: 'none', errorActiveShadow: 'none', warningActiveShadow: 'none' },
    DatePicker: { activeShadow: 'none', errorActiveShadow: 'none', warningActiveShadow: 'none', cellHoverBg: '#f3f8f5', cellActiveWithRangeBg: '#edf7f3', cellRangeBorderColor: '#9fc5b8' },
    Button: { primaryShadow: '0 3px 7px rgba(22,136,120,.12)', defaultHoverBg: '#f3f8f5', defaultHoverColor: '#168878', defaultHoverBorderColor: '#bddacf', defaultActiveBg: '#e3f1eb', defaultActiveBorderColor: '#9fc5b8' },
    Segmented: { trackBg: '#f0f4f2', itemHoverBg: '#f3f8f5', itemActiveBg: '#e3f1eb', itemSelectedBg: '#fff', itemSelectedColor: '#168878' },
    Pagination: { itemActiveBg: '#edf7f3', itemActiveBgDisabled: '#f5f7f6' },
    Modal: { borderRadiusLG: 16 },
    Table: { headerBg: '#f7f9f8', rowHoverBg: '#f3f8f5', rowSelectedBg: '#edf7f3', rowSelectedHoverBg: '#e3f1eb' },
  },
};
export default function Providers({ children }: { children: React.ReactNode }) {
  return <ConfigProvider locale={zhCN} theme={theme} wave={{ disabled: true }}><App>{children}</App></ConfigProvider>;
}
