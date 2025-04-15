import { IconButton } from 'shared/components/IconButton'

export const ToolbarButton: typeof IconButton = (props) => {
  return <IconButton {...{ ...props, class: [props.class, 'toolbar-button'] }} />
}
