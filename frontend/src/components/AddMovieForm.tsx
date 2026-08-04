import { FormEvent, useState } from "react";

interface AddMovieFormProps {
  pending: boolean;
  onAdd: (title: string, year: number) => void;
}

function AddMovieForm({ pending, onAdd }: AddMovieFormProps) {
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim(), Number(year) || 0);
    setTitle("");
    setYear("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Movie title"
        className="w-56 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-amber-400"
      />
      <input
        value={year}
        onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
        placeholder="Year"
        maxLength={4}
        className="w-20 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-amber-400"
      />
      <button
        type="submit"
        disabled={pending || !title.trim()}
        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Adding..." : "Add movie"}
      </button>
    </form>
  );
}

export default AddMovieForm;
