import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoaderCircle } from "lucide-react";

export default function DeleteDialog({
  open,
  setOpen,
  onConfirm,
  title = "Delete Item",
  description = "Are you sure you want to delete this item? This action cannot be undone!",
  loading = false,
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-600">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? (
              <>
                <LoaderCircle className="animate-spin size-4 mr-2" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
