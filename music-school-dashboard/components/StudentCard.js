export default function StudentCard({ student, onClick, isSelected, showCheckbox = false, isChecked = false, onToggleCheck }) {
  return (
    <button
      onClick={() => onClick(student)}
      className={`p-4 rounded-lg border-2 transition-all relative ${
        isSelected 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
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
      <h3 className="font-semibold text-lg">{student.name}</h3>
      <p className="text-sm text-gray-600">Tutor: {student.current_tutor}</p>
      {student.instrument && (
        <p className="text-sm text-blue-600 font-medium">{student.instrument}</p>
      )}
      {showCheckbox && (
        <p className="text-xs text-gray-500 mt-1">Click checkbox to mark as your student</p>
      )}
    </button>
  );
}
