import './Notes.css';

const notes = [
  { title: 'Grocery list', body: 'Milk, eggs, spinach, rice, dal, tomatoes, ginger-garlic paste.' },
  { title: 'Recipe — weekend pasta', body: 'Boil pasta 9 min. Garlic in olive oil, chili flakes, cherry tomatoes, basil at the end.' },
  { title: 'Meeting notes', body: 'Follow up with vendor on Thursday. Send revised deck by EOD Friday.' },
  { title: 'Book list', body: 'Finish current novel, then start the one Priya recommended.' },
];

export default function Notes() {
  return (
    <div className="notes">
      <div className="notes__inner">
        <h1>My Notes</h1>
        <div className="notes__grid">
          {notes.map((n) => (
            <div className="notes__card" key={n.title}>
              <h3>{n.title}</h3>
              <p>{n.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
