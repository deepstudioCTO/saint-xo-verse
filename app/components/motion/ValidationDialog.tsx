import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from "~/components/ui";
import { formatDuration, MAX_VIDEO_DURATION } from "~/lib/video-utils";

interface ValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "error" | "trim";
  message?: string;
  duration?: number;
  onTrim?: () => void;
}

export function ValidationDialog({
  open,
  onOpenChange,
  type,
  message,
  duration,
  onTrim,
}: ValidationDialogProps) {
  if (type === "error") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>업로드 오류</DialogTitle>
            <DialogDescription>{message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>영상 길이 초과</DialogTitle>
          <DialogDescription>
            선택한 영상의 길이가 {duration ? formatDuration(duration) : ""}입니다.
            <br />
            Replicate API는 최대 {MAX_VIDEO_DURATION}초까지 지원합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4">
          <div className="flex items-center gap-4 p-4 bg-[--color-border-light] rounded">
            <div className="flex-1">
              <p className="text-sm font-medium text-[--color-text]">
                영상을 트리밍하시겠습니까?
              </p>
              <p className="text-xs text-[--color-text-tertiary] mt-1">
                원하는 구간을 선택하여 {MAX_VIDEO_DURATION}초 이내로 잘라낼 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={onTrim}>트리밍하기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
