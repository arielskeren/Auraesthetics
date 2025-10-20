import Button from './Button';

interface DisabledNoticeProps {
  label: string;
  message?: string;
}

export default function DisabledNotice({ 
  label, 
  message = "Opens soon—join the list." 
}: DisabledNoticeProps) {
  return (
    <Button variant="disabled" tooltip={message}>
      {label}
    </Button>
  );
}

