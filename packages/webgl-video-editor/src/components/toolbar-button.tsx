import { IconButton } from 'shared/components/icon-button'

export const ToolbarButton: typeof IconButton = (props) => (
  <IconButton {...{ ...props, class: [props.class, 'toolbar-button'] }} />
)
