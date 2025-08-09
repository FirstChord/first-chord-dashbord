export default function StudentCard({ student, onClick, isSelected }) {
  return (
    <button
      onClick={() => onClick(student)}
      className={`p-4 rounded-lg border-2 transition-all ${
        isSelected 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
      }`}
    >
      <h3 className="font-semibold text-lg">{student.name}</h3>
      <p className="text-sm text-gray-600">Tutor: {student.current_tutor}</p>
    </button>
  );
}
