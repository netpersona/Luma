import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Send, Mail, TabletSmartphone, CheckCircle, AlertCircle } from "lucide-react";

interface SendToDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookId: string;
  bookTitle: string;
}

export function SendToDeviceModal({
  isOpen,
  onClose,
  bookId,
  bookTitle,
}: SendToDeviceModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"kindle" | "email">("kindle");
  const [kindleEmail, setKindleEmail] = useState("");
  const [regularEmail, setRegularEmail] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  const sendToKindleMutation = useMutation({
    mutationFn: async () => {
      setDeliveryStatus("sending");
      const response = await apiRequest("POST", "/api/delivery/kindle", {
        bookId,
        kindleEmail: kindleEmail.trim(),
      });
      return response.json();
    },
    onSuccess: () => {
      setDeliveryStatus("success");
      toast({
        title: "Sent to Kindle",
        description: `"${bookTitle}" has been sent to your Kindle device.`,
      });
      setTimeout(() => {
        setDeliveryStatus("idle");
        setKindleEmail("");
        onClose();
      }, 2000);
    },
    onError: (error: Error) => {
      setDeliveryStatus("error");
      toast({
        title: "Failed to send",
        description: error.message || "Could not send to Kindle. Please try again.",
        variant: "destructive",
      });
      setTimeout(() => setDeliveryStatus("idle"), 3000);
    },
  });

  const sendToEmailMutation = useMutation({
    mutationFn: async () => {
      setDeliveryStatus("sending");
      const response = await apiRequest("POST", "/api/delivery/email", {
        bookId,
        email: regularEmail.trim(),
      });
      return response.json();
    },
    onSuccess: () => {
      setDeliveryStatus("success");
      toast({
        title: "Sent via Email",
        description: `"${bookTitle}" has been sent to ${regularEmail}.`,
      });
      setTimeout(() => {
        setDeliveryStatus("idle");
        setRegularEmail("");
        onClose();
      }, 2000);
    },
    onError: (error: Error) => {
      setDeliveryStatus("error");
      toast({
        title: "Failed to send",
        description: error.message || "Could not send email. Please try again.",
        variant: "destructive",
      });
      setTimeout(() => setDeliveryStatus("idle"), 3000);
    },
  });

  const handleSendToKindle = () => {
    if (!kindleEmail.trim()) {
      toast({
        title: "Email required",
        description: "Please enter your Kindle email address.",
        variant: "destructive",
      });
      return;
    }
    if (!kindleEmail.includes("@kindle.com") && !kindleEmail.includes("@free.kindle.com")) {
      toast({
        title: "Invalid Kindle email",
        description: "Please enter a valid Kindle email address (ending with @kindle.com or @free.kindle.com).",
        variant: "destructive",
      });
      return;
    }
    sendToKindleMutation.mutate();
  };

  const handleSendToEmail = () => {
    if (!regularEmail.trim()) {
      toast({
        title: "Email required",
        description: "Please enter an email address.",
        variant: "destructive",
      });
      return;
    }
    if (!regularEmail.includes("@")) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }
    sendToEmailMutation.mutate();
  };

  const isPending = sendToKindleMutation.isPending || sendToEmailMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Book
          </DialogTitle>
          <DialogDescription>
            Send "{bookTitle}" to your device or email.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "kindle" | "email")} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="kindle" data-testid="tab-kindle" className="gap-2">
              <TabletSmartphone className="h-4 w-4" />
              Kindle
            </TabsTrigger>
            <TabsTrigger value="email" data-testid="tab-email" className="gap-2">
              <Mail className="h-4 w-4" />
              Email
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kindle" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="kindle-email">Kindle Email Address</Label>
              <Input
                id="kindle-email"
                data-testid="input-kindle-email"
                type="email"
                placeholder="yourname@kindle.com"
                value={kindleEmail}
                onChange={(e) => setKindleEmail(e.target.value)}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">
                Find your Kindle email in your Amazon account under "Manage Your Content and Devices".
              </p>
            </div>
            
            {deliveryStatus === "success" ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span>Sent successfully!</span>
              </div>
            ) : deliveryStatus === "error" ? (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="h-5 w-5" />
                <span>Failed to send. Please try again.</span>
              </div>
            ) : (
              <Button 
                onClick={handleSendToKindle} 
                disabled={isPending}
                className="w-full"
                data-testid="button-send-to-kindle"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <TabletSmartphone className="mr-2 h-4 w-4" />
                    Send to Kindle
                  </>
                )}
              </Button>
            )}

            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium mb-1">Note:</p>
              <p className="text-muted-foreground">
                Make sure you've added the sender email to your approved list in Amazon settings.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="email" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="regular-email">Email Address</Label>
              <Input
                id="regular-email"
                data-testid="input-regular-email"
                type="email"
                placeholder="you@example.com"
                value={regularEmail}
                onChange={(e) => setRegularEmail(e.target.value)}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">
                The book file will be sent as an email attachment.
              </p>
            </div>
            
            {deliveryStatus === "success" ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span>Email sent successfully!</span>
              </div>
            ) : deliveryStatus === "error" ? (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="h-5 w-5" />
                <span>Failed to send. Please try again.</span>
              </div>
            ) : (
              <Button 
                onClick={handleSendToEmail} 
                disabled={isPending}
                className="w-full"
                data-testid="button-send-email"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send via Email
                  </>
                )}
              </Button>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
