import { Slide, toast, ToastOptions } from 'react-toastify';

export enum NotifMode {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  SUCCESS = "success",
}

export const notify = (message: string, mode: NotifMode) => {
  const params: ToastOptions = {
    position: "bottom-right",
    autoClose: 2000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
    transition: Slide,
    theme: "dark",
  }
  switch (mode) {
    case NotifMode.INFO:
      toast.info(message, params);
      break;
    case NotifMode.WARNING:
      toast.warning(message, params);
      break;
    case NotifMode.ERROR:
      toast.error(message, params);
      break;
    case NotifMode.SUCCESS:
      toast.success(message, params);
      break;
  }
}

