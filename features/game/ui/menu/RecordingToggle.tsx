import React from 'react';
import { useTranslation } from 'react-i18next';

interface RecordingToggleProps {
  enableRecording: boolean;
  setEnableRecording: (v: boolean) => void;
  disabled: boolean;
}

const RecordingToggle: React.FC<RecordingToggleProps> = ({ enableRecording, setEnableRecording, disabled }) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setEnableRecording(!enableRecording)}
      aria-pressed={enableRecording}
      className={`w-full flex items-center justify-between border-4 border-black p-3 md:p-4 rounded-xl transition-colors ${enableRecording ? 'bg-green-50' : 'bg-gray-100'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-200'}`}
    >
      <div className="flex flex-col items-start text-left">
        <span className="font-black uppercase text-sm md:text-lg text-black">{t('recording.title')}</span>
        <span className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wide leading-tight">{enableRecording ? t('recording.onHint') : t('recording.offHint')}</span>
      </div>
      <div className={`relative w-12 md:w-16 h-7 md:h-8 rounded-full border-4 border-black transition-colors duration-300 ${enableRecording ? 'bg-[#00ff99]' : 'bg-gray-300'}`}>
        <div className={`absolute top-1/2 -translate-y-1/2 w-5 md:w-6 h-5 md:h-6 bg-white border-2 border-black rounded-full shadow-sm transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${enableRecording ? 'left-[calc(100%-1.5rem)] md:left-[calc(100%-1.75rem)]' : 'left-0.5 md:left-1'}`} />
      </div>
    </button>
  );
};

export default RecordingToggle;