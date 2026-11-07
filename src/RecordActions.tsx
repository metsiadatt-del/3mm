import { createContext, useContext } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { Entity } from "./records";
export const RecordContext = createContext<
  (action: "edit" | "delete", entity: Entity, id: string) => void
>(() => {});
export function RecordActions({ entity, id }: { entity: Entity; id: string }) {
  const action = useContext(RecordContext);
  return (
    <div className="record-actions">
      <button
        type="button"
        className="secondary"
        onClick={() => action("edit", entity, id)}
      >
        <Pencil size={15} />
        ویرایش
      </button>
      <button
        type="button"
        className="secondary delete-action"
        onClick={() => action("delete", entity, id)}
      >
        <Trash2 size={15} />
        حذف
      </button>
    </div>
  );
}
