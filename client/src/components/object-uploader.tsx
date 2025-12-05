import { useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import DashboardModal from "@uppy/react/dashboard-modal";
import AwsS3 from "@uppy/aws-s3";
import type { UploadResult } from "@uppy/core";
import { Button } from "@/components/ui/button";

import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  onGetUploadParameters: (file: { name: string; type: string; size: number }) => Promise<{
    method: "PUT";
    url: string;
    headers?: Record<string, string>;
  }>;
  onComplete?: (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>
  ) => void;
  buttonClassName?: string;
  buttonVariant?: "default" | "outline" | "ghost" | "secondary";
  children: ReactNode;
}

export function ObjectUploader({
  maxNumberOfFiles = 10,
  maxFileSize = 524288000, // 500MB default
  allowedFileTypes,
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  buttonVariant = "default",
  children,
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  
  // Use refs to ensure we always call the latest callback versions
  const onCompleteRef = useRef(onComplete);
  const onGetUploadParametersRef = useRef(onGetUploadParameters);
  
  // Keep refs in sync with props
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  
  useEffect(() => {
    onGetUploadParametersRef.current = onGetUploadParameters;
  }, [onGetUploadParameters]);
  
  const [uppy] = useState(() => {
    const uppyInstance = new Uppy({
      restrictions: {
        maxNumberOfFiles,
        maxFileSize,
        allowedFileTypes,
      },
      autoProceed: false,
    });

    uppyInstance
      .use(AwsS3, {
        shouldUseMultipart: false,
        getUploadParameters: async (file) => {
          // Use ref to always call the latest callback, passing file info
          const params = await onGetUploadParametersRef.current({
            name: file.name || 'file',
            type: file.type || 'application/octet-stream',
            size: file.size || 0,
          });
          return params;
        },
      })
      .on("complete", async (result) => {
        console.log('[Uppy] Complete event fired!', result);
        // Call the completion handler before closing the modal
        const callback = onCompleteRef.current;
        if (callback) {
          console.log('[Uppy] Calling onComplete callback...');
          try {
            await callback(result);
            console.log('[Uppy] onComplete callback finished successfully');
          } catch (error) {
            console.error('[Uppy] Error in onComplete callback:', error);
            alert('Upload processing failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
          }
        } else {
          console.warn('[Uppy] No onComplete callback set!');
        }
        // Close modal after processing is complete
        setShowModal(false);
      })
      .on("upload-success", (file, response) => {
        console.log('[Uppy] Upload success:', file?.name, response);
      })
      .on("upload-error", (file, error) => {
        console.error('[Uppy] Upload error:', file?.name, error);
        alert(`Upload failed for ${file?.name}: ${error?.message || 'Unknown error'}`);
      });

    return uppyInstance;
  });

  return (
    <div>
      <Button 
        onClick={() => setShowModal(true)} 
        className={buttonClassName}
        variant={buttonVariant}
        data-testid="button-open-uploader"
      >
        {children}
      </Button>

      <DashboardModal
        uppy={uppy}
        open={showModal}
        onRequestClose={() => setShowModal(false)}
        proudlyDisplayPoweredByUppy={false}
      />
    </div>
  );
}
