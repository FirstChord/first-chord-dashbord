import InstrumentIcon from './InstrumentIcon';

export default function StudentCard({ student, onClick, isSelected, showTutor = true, todayTime = '', showCheckbox = false, isChecked = false, onToggleCheck }) {
  return (
    <button
      onClick={() => onClick(student)}
      aria-pressed={isSelected}
      className={`w-full p-4 rounded-lg border-2 text-left transition-all duration-150 relative ${
        isSelected
          ? 'border-[#2F6B3D] bg-green-50 shadow-sm'
          : 'border-gray-200 bg-white/60 hover:border-[#2F6B3D]/40 hover:bg-white hover:shadow-md'
      }`}
    >
      {showCheckbox && (
        <div
          className="absolute top-2 right-2"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCheck?.(student.mms_id);
          }}
        >
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => {}} // Controlled by parent
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
          />
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-lg">{student.name}</h3>
        <InstrumentIcon instrument={student.instrument} />
      </div>
      {todayTime && (
        <p className="mt-1">
          <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-semibold text-[#2F6B3D]">
            {todayTime} today
          </span>
        </p>
      )}
      {showTutor && (
        <p className="text-sm text-gray-600">Tutor: {student.current_tutor}</p>
      )}
      {showCheckbox && (
        <p className="text-xs text-gray-500 mt-1">Click checkbox to mark as your student</p>
      )}
    </button>
  );
}
